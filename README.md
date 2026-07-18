# 影片震動 → 搖桿 (Video Haptics → Joystick)

把影片中「模擬畫面的震動」——走路的腳步、車子引擎的轟隆、手觸摸物體的細節、撞擊等——
即時轉換成遊戲手把的震動回饋。全部在瀏覽器本機執行,影片**不會上傳**。

## 運作原理

三個訊號來源疊加後,對應到手把的兩顆震動馬達:

| 來源 | 做法 | 對應馬達 |
| --- | --- | --- |
| **音訊分析** | Web Audio API 做 FFT,拆成低頻(20–160Hz)、中頻、高頻(2–8kHz),再偵測瞬態(onset) | 低頻→大馬達;高頻/瞬態→小馬達 |
| **畫面運動分析** | 把影片畫到 64×36 離屏 canvas,比對相鄰影格的亮度差 → 全域運動強度 | 疊加到大馬達 |
| **AI 場景辨識** | 用音訊+運動的短時特徵,以啟發式規則判斷 `走路 / 引擎 / 觸摸 / 衝擊`,自動套用對應的震動曲線 | 調整兩馬達的權重 |

輸出透過 **Web Gamepad API** 的 `vibrationActuator.playEffect('dual-rumble', …)`,
支援 Xbox 與多數 PC 手把。

> 目前的「AI 場景辨識」是啟發式(規則式)實作,不需下載模型即可運作。
> `SceneClassifier` 的介面已保留擴充點,日後可換成 TensorFlow.js 模型而不動其他程式。

## 開發

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173
npm run build    # 型別檢查 + 打包到 dist/
npm run preview  # 預覽打包結果
```

## 使用

1. 用支援震動的手把(Xbox 等)連接電腦,**按一下任意鍵**喚醒它(瀏覽器安全限制)。
2. 開啟網頁,拖曳或選擇一段影片。
3. 播放影片即可感受到對應的震動。可用右側面板即時調整:
   - 開關各訊號來源、切換場景模式(自動 / 走路 / 引擎 / 觸摸 / 衝擊)
   - 整體強度、雜訊門檻、低頻/高頻權重
   - 「測試手把震動」按鈕確認手把可用

## 瀏覽器支援

- 需支援 Gamepad API 的 `vibrationActuator`(Chrome / Edge 較完整)。
- 影片音訊分析需 `AudioContext`,須由使用者操作(播放)觸發。

## 結構

```
src/
  main.ts                 # orchestrator + UI 綁定 + render loop
  lib/
    audioAnalyser.ts       # 音訊頻段 / 瞬態特徵
    motionAnalyser.ts      # 畫面運動強度
    sceneClassifier.ts     # 場景辨識(啟發式,可換模型)
    hapticEngine.ts        # 特徵 → 馬達強度(場景曲線 + 包絡平滑)
    gamepadManager.ts      # Gamepad API 震動輸出(節流)
    types.ts
```
