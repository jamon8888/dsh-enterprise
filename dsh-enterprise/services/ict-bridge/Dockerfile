FROM python:3.9-slim
WORKDIR /app
RUN pip install uv && uv sync --locked
COPY . /app
EXPOSE 8787
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
