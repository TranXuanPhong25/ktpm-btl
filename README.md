# Note

Nếu bị lỗi khi chạy, hãy docker exec mongo tương ứng và chạy

```
mongosh
```

```
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "<service-name>:27017" }
  ]
})
```
