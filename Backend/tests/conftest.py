import os

# Must be set before main.py is imported (it reads env at module load).
# setdefault + main's load_dotenv(no-override) means these win in tests
# even when a real Backend/.env exists locally.
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ["SUPABASE_JWT_SECRET"] = "test-jwt-secret-0123456789abcdef0123456789abcdef"
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
