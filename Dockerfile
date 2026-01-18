FROM node:20 as build
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn build

FROM golang:1.24 as go-build
WORKDIR /app
COPY --from=build /app /app
RUN go build -o /app/server /app/main.go

FROM alpine:3.19.1
COPY --from=go-build /app/dist /app/dist
COPY --from=go-build /app/server /app/server
RUN mkdir /lib64 && ln -s /lib/libc.musl-x86_64.so.1 /lib64/ld-linux-x86-64.so.2
RUN chmod +x /app/server
CMD ["/app/server"]