# Project Structure

| Directory | Purpose |
|-----------|---------|
| `config/` | Settings, environment variables, and constants |
| `core/` | Application startup, security, and middleware |
| `data/` | Datasets, uploads, and outputs |
| `logs/` | Inference and system logs |
| `models/` | Pre-trained `.pt` files and weights |
| `modules/` | Domain-specific business logic |
| `tests/` | Unit and integration tests |
| `utils/` | Shared utility helpers |
| `main.py` | Create the FastAPI app, Load config, Register routers, Add middleware, and Start the system |

