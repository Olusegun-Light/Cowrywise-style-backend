NODE_ENV ?= development

PG_DATA := /opt/homebrew/var/postgresql@18
PG_LOG := /opt/homebrew/var/log/postgresql@18.log
REDIS_CONF := /opt/homebrew/etc/redis.conf

.PHONY: start dev restart stop db-up db-down redis-up redis-down status logs db-shell migrate build clean obs-up obs-down obs-logs obs-status rabbitmq-up rabbitmq-down

# ===============================
# SMART COMMANDS
# ===============================

start: db-up redis-up rabbitmq-up dev

dev:
	@echo "🚀 Starting API in dev mode (NODE_ENV=$(NODE_ENV))..."
	npm run dev

restart:
	@echo "🔄 Restarting dev server..."
	@pkill -f "ts-node-dev.*src/index.ts" 2>/dev/null || true
	@$(MAKE) dev

stop: db-down redis-down rabbitmq-down
	@echo "🛑 Stack stopped."

status:
	@echo "📊 Service status:"
	@pg_isready || true
	@redis-cli ping || true
	@rabbitmqctl status > /dev/null 2>&1 && echo "RabbitMQ up" || echo "❌ RabbitMQ down"

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

# ===============================
# OBSERVABILITY (dedicated Loki/Promtail/Grafana stack for this project)
# ===============================

obs-up:
	@echo "📈 Starting cowrywise's own app + Loki + Promtail + Prometheus + Grafana stack..."
	docker compose up -d --build

obs-down:
	@echo "📈 Stopping cowrywise's observability stack..."
	docker compose down

obs-logs:
	@echo "📈 Tailing docker-compose logs (Ctrl+C to stop)..."
	docker compose logs -f

obs-status:
	@docker compose ps


# ===============================
# RABBITMQ
# ===============================

rabbitmq-up:
	@rabbitmqctl status > /dev/null 2>&1 && echo "✅ RabbitMQ already running" || ( \
			echo "🐇 Starting RabbitMQ..." && \
			brew services start rabbitmq \
	)

rabbitmq-down:
	@echo "🐇 Stopping RabbitMQ..."
	@brew services stop rabbitmq || true