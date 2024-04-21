FROM node:14.15.4 as build
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build

FROM golang:1.15.6 as go-build
WORKDIR /app
COPY --from=build /app /app
RUN go build -o /app/server /app/main.go

FROM golang:1.15.6
COPY --from=go-build /app/server /app/server
CMD ["/app/server"]