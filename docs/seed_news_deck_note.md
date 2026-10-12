# Hook：由新聞牌表寫入 Deck 參考

文章 override 可帶：

```json
"related_decks": [{ "name": "…", "code": "1|…", "note": "…" }]
```

站內會顯示「匯入此構築」。若要永久出現喺 **MHR 編輯群** tab：

1. TCG 核對 code 可匯入、50 張、≤2 色、無 Rush Point。
2. 喺 `data/decks.json` 加一筆，例如：

```json
{
  "id": "news-<short-slug>",
  "name": "……",
  "colors": ["Red", "Blue"],
  "set": "SP01",
  "author": "MHR 編輯群",
  "source": "新聞改寫",
  "source_url": "#news/<news-id>",
  "date": "2026-10-12",
  "total": 50,
  "code": "1|…",
  "note": "來源見站內新聞；牌表經 TCG 核對。",
  "cards": []
}
```

（`cards` 可留空或補卡表；匯入靠 `code`。）

3. 同一 news id 嘅 override 加 `"related_deck_ids": ["news-<short-slug>"]`。
