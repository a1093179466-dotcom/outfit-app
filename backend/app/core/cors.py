from fastapi.middleware.cors import CORSMiddleware

def add_cors(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 本地开发先放开
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )