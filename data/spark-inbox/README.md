# data/spark-inbox/

运行时灵感收件箱目录。

本地模式下，`app/api/spark/route.ts` 会按账号写入：

```text
data/spark-inbox/<account_id>/<spark_id>.json
```

这些条目是下一轮跑批前的人工参考输入，不会直接改写 `data/today/`。
