run:
	docker-compose up --build -d

build: container

container:
	docker-compose build
