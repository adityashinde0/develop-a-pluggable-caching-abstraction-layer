"""REST API server exposing unified caching endpoints and dynamic runtime backend switching."""

import threading
from contextlib import asynccontextmanager, contextmanager
from typing import Any, Dict, Generator, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from cache_layer.config import CacheConfig
from cache_layer.exceptions import (
    CacheBackendError,
    CacheConfigurationError,
    CacheConnectionError,
    CacheError,
    CacheSerializationError,
    CacheTimeoutError,
    CacheValidationError,
)
from cache_layer.factory import ProviderFactory
from cache_layer.service import CacheService


class ServiceManager:
    """Thread-safe CacheService lifecycle manager with active operation reference-counting

    and safe deferred resource draining on backend switch.
    """

    def __init__(self, initial_service: Optional[CacheService] = None):
        self._lock = threading.RLock()
        self._current_service = initial_service
        self._active_readers = 0
        self._retired_services: List[CacheService] = []

    def get_service(self) -> CacheService:
        with self._lock:
            if self._current_service is None:
                self._current_service = ProviderFactory.create_service()
            return self._current_service

    @contextmanager
    def operation(self) -> Generator[CacheService, None, None]:
        """Context manager tracking active in-flight cache operations.

        Ensures that a service retired by a concurrent switch_service() call is never
        closed until all active operations on it have completed.
        """
        with self._lock:
            if self._current_service is None:
                self._current_service = ProviderFactory.create_service()
            service = self._current_service
            self._active_readers += 1
        try:
            yield service
        finally:
            to_close: List[CacheService] = []
            with self._lock:
                self._active_readers -= 1
                if self._active_readers == 0 and self._retired_services:
                    to_close = self._retired_services[:]
                    self._retired_services.clear()
            for s in to_close:
                try:
                    s.close()
                except Exception:
                    pass

    def switch_service(self, new_service: CacheService) -> None:
        """Atomically switch to new_service and safely defer closing the retired service

        until all active in-flight requests complete.
        """
        to_close = None
        with self._lock:
            old_service = self._current_service
            self._current_service = new_service
            if old_service is not None and old_service is not new_service:
                if self._active_readers == 0:
                    to_close = old_service
                else:
                    self._retired_services.append(old_service)
        if to_close is not None:
            try:
                to_close.close()
            except Exception:
                pass

    def close(self) -> None:
        with self._lock:
            if self._current_service is not None:
                try:
                    self._current_service.close()
                except Exception:
                    pass
                self._current_service = None
            for s in self._retired_services:
                try:
                    s.close()
                except Exception:
                    pass
            self._retired_services.clear()


# Global ServiceManager instance
_service_manager = ServiceManager()


def get_cache_service() -> CacheService:
    """Get active global CacheService."""
    return _service_manager.get_service()


def set_cache_service(service: CacheService) -> None:
    """Safely replace the active global CacheService with reference-counted draining."""
    _service_manager.switch_service(service)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure service is initialized
    _service_manager.get_service()
    yield
    # Shutdown: close all open connections
    _service_manager.close()


app = FastAPI(
    title="Pluggable Caching Abstraction API",
    description="Unified, configuration-driven caching service supporting interchangeable Redis and Memcached backends.",
    version="1.0.0",
    lifespan=lifespan,
)


class CachePutRequest(BaseModel):
    value: Any = Field(..., description="Value to store in cache (JSON-serializable, primitive, or string).")
    ttl: Optional[int] = Field(None, ge=0, description="Optional Time-to-Live in seconds.")


class CacheSwitchRequest(BaseModel):
    backend: str = Field(..., description="Target backend provider ('redis' or 'memcached').")
    namespace: Optional[str] = Field(None, description="Optional namespace prefix.")
    redis: Optional[Dict[str, Any]] = Field(None, description="Optional Redis backend configuration.")
    memcached: Optional[Dict[str, Any]] = Field(None, description="Optional Memcached backend configuration.")


# Exception Handlers
@app.exception_handler(CacheValidationError)
async def validation_error_handler(request: Request, exc: CacheValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "ValidationError", "detail": str(exc)},
    )


@app.exception_handler(CacheConnectionError)
async def connection_error_handler(request: Request, exc: CacheConnectionError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "ConnectionError", "detail": str(exc)},
    )


@app.exception_handler(CacheTimeoutError)
async def timeout_error_handler(request: Request, exc: CacheTimeoutError):
    return JSONResponse(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        content={"error": "TimeoutError", "detail": str(exc)},
    )


@app.exception_handler(CacheConfigurationError)
async def config_error_handler(request: Request, exc: CacheConfigurationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "ConfigurationError", "detail": str(exc)},
    )


@app.exception_handler(CacheError)
async def generic_cache_error_handler(request: Request, exc: CacheError):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "CacheError", "detail": str(exc)},
    )


# API Endpoints
@app.get("/health", summary="Health check", tags=["System"])
def health_check():
    """Report abstraction and backend health status."""
    with _service_manager.operation() as service:
        health = service.health_check()
        status_code = status.HTTP_200_OK if health.get("status") == "healthy" else status.HTTP_503_SERVICE_UNAVAILABLE
        return JSONResponse(status_code=status_code, content=health)


@app.get("/cache/info", summary="Cache info", tags=["System"])
def cache_info():
    """Retrieve current cache provider configuration and status."""
    with _service_manager.operation() as service:
        return {
            "provider": service.provider_name,
            "namespace": service.namespace,
        }


@app.get("/cache/metrics", summary="Cache metrics snapshot", tags=["Observability"])
def cache_metrics():
    """Retrieve runtime cache metrics (hits, misses, hit ratio, average/p50/p95 latencies)."""
    with _service_manager.operation() as service:
        return service.get_metrics()


@app.post("/cache/metrics/reset", summary="Reset cache metrics", tags=["Observability"])
def reset_cache_metrics():
    """Reset all aggregated metrics counters and latency samples."""
    with _service_manager.operation() as service:
        service.reset_metrics()
        return {"status": "metrics_reset", "provider": service.provider_name}


@app.get("/cache/{key}", summary="Retrieve cached value", tags=["Cache Operations"])
def get_cache(key: str):
    """Retrieve a value by key.

    Disambiguates Cache Miss (404) vs Cached None (200 with value: null).
    """
    with _service_manager.operation() as service:
        is_hit, val = service.get_with_status(key)
        if not is_hit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Key '{key}' not found in cache",
            )
        return {
            "key": key,
            "value": val,
            "cached": True,
            "provider": service.provider_name,
        }


@app.put("/cache/{key}", summary="Store value in cache", tags=["Cache Operations"])
def set_cache(key: str, req: CachePutRequest):
    """Store a value under the given key with optional TTL."""
    with _service_manager.operation() as service:
        success = service.set(key, req.value, ttl=req.ttl)
        return {
            "key": key,
            "stored": success,
            "ttl": req.ttl,
            "provider": service.provider_name,
        }


@app.delete("/cache/{key}", summary="Delete key from cache", tags=["Cache Operations"])
def delete_cache(key: str):
    """Delete a specific key from the cache."""
    with _service_manager.operation() as service:
        success = service.delete(key)
        return {
            "key": key,
            "deleted": success,
            "provider": service.provider_name,
        }


@app.delete("/cache", summary="Clear cache store", tags=["Cache Operations"])
def clear_cache():
    """Clear entries in the configured cache store or namespace."""
    with _service_manager.operation() as service:
        success = service.clear()
        return {
            "cleared": success,
            "provider": service.provider_name,
            "namespace": service.namespace,
        }


@app.post("/cache/switch", summary="Switch backend at runtime", tags=["System"])
def switch_backend(req: CacheSwitchRequest):
    """Dynamically switch the active cache backend with pre-switch validation and active-operation draining."""
    data = req.model_dump(exclude_none=True)
    new_service = ProviderFactory.create_service(data)

    # Pre-switch health validation
    health = new_service.health_check()
    if health.get("status") != "healthy":
        new_service.close()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Cannot switch to '{req.backend}': Target provider failed health check ({health.get('details', {})})",
        )

    # Atomically replace active service and safely defer retiring old connections
    _service_manager.switch_service(new_service)
    return {
        "status": "switched",
        "provider": new_service.provider_name,
        "namespace": new_service.namespace,
    }


# -------------------------------------------------------------
# Real-World E-Commerce Application Endpoints
# -------------------------------------------------------------
from examples.ecommerce_service import ProductCatalogService


class ProductPriceUpdateRequest(BaseModel):
    price: float = Field(..., gt=0, description="New price for the product")


@app.get("/products/{product_id}", summary="Get product details with cache-aside", tags=["E-Commerce Application"])
def get_product(product_id: str):
    """Retrieve product data using transparent cache-aside pattern."""
    with _service_manager.operation() as service:
        catalog = ProductCatalogService(service)
        product = catalog.get_product(product_id)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{product_id}' not found in catalog",
            )
        return product


@app.put("/products/{product_id}/price", summary="Update product price & invalidate cache", tags=["E-Commerce Application"])
def update_product_price(product_id: str, req: ProductPriceUpdateRequest):
    """Update product price in the database and invalidate the cached entry."""
    with _service_manager.operation() as service:
        catalog = ProductCatalogService(service)
        success = catalog.update_product_price(product_id, req.price)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{product_id}' not found in catalog",
            )
        return {
            "product_id": product_id,
            "updated": True,
            "new_price": req.price,
            "cache_invalidated": True,
        }
