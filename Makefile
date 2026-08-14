# Note: we deliberately do NOT `include .env` here. Make's `export` copies
# values verbatim, including quote characters (e.g. DATABASE_URL="postgresql://..."
# becomes the literal string "postgresql://..." with quotes baked in), which broke
# Zod's URL validation. The Node app loads .env itself via dotenv, which strips
# quotes correctly — Make doesn't need to touch it at all.
NODE_ENV ?= development

PG_DATA := /opt/homebrew/var/postgresql@18
PG_LOG := /opt/homebrew/var/log/postgresql@18.log
REDIS_CONF := /opt/homebrew/etc/redis.conf

.PHONY: start dev stop db-up db-down redis-up redis-down status logs db-shell migrate build clean

# ===============================
# SMART COMMANDS
# ===============================

start: db-up redis-up dev

dev:
	@echo "🚀 Starting API in dev mode (NODE_ENV=$(NODE_ENV))..."
	npm run dev

stop: db-down redis-down
	@echo "🛑 Stack stopped."

status:
	@echo "📊 Service status:"
	@pg_isready || true
	@redis-cli ping || true

logs:
	@echo "📜 Tailing Postgres log (Ctrl+C to stop)..."
	tail -f $(PG_LOG)

# ===============================
# POSTGRES
# ===============================

db-up:
	@pg_isready -q && echo "✅ Postgres already running" || ( \
		echo "🐘 Starting Postgres..." && \
		pg_ctl -D $(PG_DATA) -l $(PG_LOG) start \
	)

db-down:
	@echo "🐘 Stopping Postgres..."
	@pg_ctl -D $(PG_DATA) stop -m fast || true

db-shell:
	@echo "🐚 Opening psql shell on cowrywise_dev..."
	psql -d cowrywise_dev

migrate:
	npx prisma migrate dev

# ===============================
# REDIS
# ===============================

redis-up:
	@redis-cli ping > /dev/null 2>&1 && echo "✅ Redis already running" || ( \
		echo "📮 Starting Redis..." && \
		redis-server $(REDIS_CONF) --daemonize yes \
	)

redis-down:
	@echo "📮 Stopping Redis..."
	@redis-cli shutdown nosave || true

# ===============================
# BUILD
# ===============================

build:
	npm run build

clean:
	@echo "🧹 Removing build output (dist/)..."
	rm -rf dist
