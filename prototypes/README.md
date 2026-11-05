# Deck Builder 視覺方向（A / B / D）

三個可點的靜態原型，用來選下一版牌組介面的方向。它們**不是**正式改版，也不會改到現有 `index.html`。

卡圖與卡文來自本 repo 的真實資料（`js/cards.js` 抽了 41 張，見 `sample-data.js`）。預載了一副 31 張的「RG 復仇者速攻」，方便直接看牌組欄。規則提示跟現有工具一致：50 張、最多 2 色、同名最多 3 張。搜尋、篩色、篩等級、加減張數、卡面詳情都可以點。卡賽用了 News 裡的三則真消息（Infinity Clash HK、新加坡、ASCC 四強）。

| | 檔案 | 感覺 |
|---|---|---|
| **A** | [`revamp-a/index.html`](revamp-a/index.html) | 乾淨、高密度。列上直接加減，右側是曲線、規則和正在看的卡。給想組得快的人。 |
| **B** | [`revamp-b/index.html`](revamp-b/index.html) | 卡面優先。大卡站在左側，右邊是收藏牆，底下是一排手牌。給想先看圖的人。 |
| **D** | [`revamp-d/index.html`](revamp-d/index.html) | 暗色賽事轉播，紅金斜切，跟現有青色 HUD 不是同一條路。卡賽以跑馬燈和賽事卡呈現。 |

目錄頁：[`index.html`](index.html)。三個原型右上角可以互跳。

每個原型的畫面和互動都寫在自己的 `index.html` 裡，共用 `prototypes/sample-data.js`，卡圖走 `img/cards/`。重新整理會記住這一分頁的牌組（sessionStorage）。「還原」回到範例牌組。

## 怎麼看

在 repo 根目錄：

```bash
python3 -m http.server 8765
```

然後開：

- http://localhost:8765/prototypes/
- http://localhost:8765/prototypes/revamp-a/
- http://localhost:8765/prototypes/revamp-b/
- http://localhost:8765/prototypes/revamp-d/

這條分支推上 GitHub 之後，不必合併 main、也不必動正式 GitHub Pages，可以用 Statically 直接看（把分支名換掉即可）：

- https://cdn.statically.io/gh/aaronht88/marvel-hero-rush-deck/cursor/deck-revamp-prototypes-7c88/prototypes/index.html
- https://cdn.statically.io/gh/aaronht88/marvel-hero-rush-deck/cursor/deck-revamp-prototypes-7c88/prototypes/revamp-a/index.html
- https://cdn.statically.io/gh/aaronht88/marvel-hero-rush-deck/cursor/deck-revamp-prototypes-7c88/prototypes/revamp-b/index.html
- https://cdn.statically.io/gh/aaronht88/marvel-hero-rush-deck/cursor/deck-revamp-prototypes-7c88/prototypes/revamp-d/index.html

Statically 有時要等一兩分鐘才抓到新 commit。另一個預覽：

`https://htmlpreview.github.io/?https://github.com/aaronht88/marvel-hero-rush-deck/blob/cursor/deck-revamp-prototypes-7c88/prototypes/index.html`

正式站 https://mhrdeckbuild.duckdns.org 與 `main` 都不會因為這份草稿而改變。
