FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files & buffer stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy dependency definition
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and tests
COPY . .

# Default command runs the complete test suite with coverage
CMD ["pytest", "--cov=cache_layer", "-v"]
