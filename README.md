# IoT Edge Computing - 高齢者見守りシステム

M5Stack Core2 (ESP32) を活用した、リアルタイム転倒検知、環境モニタリング、緊急通報機能を備えた包括的な高齢者見守りIoTシステムです。

## 📌 プロジェクト概要

本システムは、一人暮らしの高齢者を対象とした包括的な見守りシステムです。複数のM5StackデバイスがMQTT通信で連携し、転倒検知、環境モニタリング（WBGT熱中症指標計算含む）、緊急アラート、リアルタイムWebダッシュボードによる履歴データ分析を提供します。

**デモサイト**: http://50.16.142.67:8000 (AWS EC2にデプロイ済み)

## 🏗 システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    IoT Edge System                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  M5Stack デバイス (エッジ層)                                │
│  ├─ 転倒検知ユニット (ベルト装着型センサー)                  │
│  ├─ 環境モニタリングユニット (温度/湿度/気圧)                │
│  └─ コミュニケーションユニット (緊急ボタン + ディスプレイ)    │
│              │                                               │
│              ▼ MQTT (Wi-Fi)                                  │
│                                                              │
│  Docker Compose スタック (AWS EC2 / ローカル)                │
│  ├─ Mosquitto MQTT ブローカー (ポート 1883)                  │
│  ├─ PostgreSQL データベース (ポート 5432)                    │
│  └─ Flask サーバー (ポート 8000)                             │
│              │                                               │
│              ▼ WebSocket                                     │
│                                                              │
│  Web ダッシュボード (ブラウザ)                               │
│  ├─ リアルタイムチャート (Chart.js)                          │
│  ├─ 統計パネル (24時間集計)                                  │
│  ├─ イベント履歴 (フィルタリング機能)                         │
│  └─ アラート通知 (音声付き)                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 技術スタック

**エッジデバイス:**
- M5Stack Core2 (ESP32)
- PlatformIO (ファームウェア開発)
- Arduinoフレームワーク
- MQTT クライアント (PubSubClient)

**バックエンド:**
- Flask (Python Webフレームワーク)
- PostgreSQL (時系列データストレージ)
- Mosquitto MQTT ブローカー
- Flask-SocketIO (リアルタイムWebSocket)
- psycopg2 (データベース接続プーリング)

**フロントエンド:**
- HTML5 + JavaScript
- Socket.IO (リアルタイム更新)
- Chart.js (データ可視化)

**デプロイメント:**
- Docker + Docker Compose
- Nix (再現可能ビルド)
- AWS EC2 (クラウドホスティング)

## 🛠 ハードウェア構成

### 1. 転倒検知ユニット (ベルト装着型)
- **デバイス:** M5Stack Core2
- **センサー:** 内蔵IMU (3軸加速度センサー)
- **機能:**
  - G値計算による転倒検知 (閾値: 2.5G)
  - アラート時の振動フィードバック
  - 30秒間隔のハートビート + バッテリー状態送信
  - 誤検知防止のための3秒クールダウン

### 2. 環境モニタリングユニット (居室設置)
- **デバイス:** M5Stack Core2
- **センサー:** M5Stack Unit ENV III (SHT30 + QMP6988)
- **測定項目:**
  - 温度 (°C)
  - 湿度 (%)
  - 気圧 (Pa)
- **更新頻度:** 5秒ごと
- **サーバー側処理:** 受信した温度・湿度からWBGT (暑さ指数) を自動計算

### 3. コミュニケーションユニット (ベッドサイド)
- **デバイス:** M5Stack Core2
- **機能:**
  - 緊急ヘルプボタン (ボタンA)
  - 着信メッセージ表示用LCD
  - カラーコード付きメッセージ表示 (赤/緑/白)
  - 振動フィードバック
  - ダッシュボードとの双方向通信

## 💻 ソフトウェア機能

### データベース統合 (PostgreSQL)

時系列データ用の2つのメインテーブル:

**Heat テーブル:**
```sql
CREATE TABLE Heat (
    time TIMESTAMP PRIMARY KEY,
    temp DECIMAL(10,2),      -- 温度 (°C)
    hum DECIMAL(10,2),       -- 湿度 (%)
    wbgt DECIMAL(10,2)       -- 暑さ指数 (WBGT)
);
```

**Commu テーブル:**
```sql
CREATE TABLE Commu (
    time TIMESTAMP PRIMARY KEY,
    emerg BOOLEAN,           -- 緊急フラグ
    msg TEXT                 -- メッセージ内容
);
```

### ダッシュボード機能

- **リアルタイムチャート:** Chart.jsによる温度・湿度のトレンド表示
- **統計パネル:** 温度・湿度の24時間最小/最大/平均値
- **イベント履歴:** 緊急/全イベントでフィルタリング可能なテーブル
- **アラート閾値:** 設定可能な制限値と視覚的警告
- **音声通知:** 緊急時のブラウザベースアラート
- **バッテリー監視:** 全デバイスのカラーコード付きバッテリー状態表示

### WBGT計算（バックエンド）

システムは **Stull式 (2011年)** を使用して暑さ指数（WBGT）を自動計算し、データベースに保存します:

```
WBGT = 0.7 × 湿球温度 + 0.3 × 乾球温度
```

**注意:** WBGTは現在、データベースに保存され、API経由でアクセス可能ですが、ダッシュボードには表示されていません。将来のバージョンで視覚化予定です。

## 🚀 クイックスタート

### 必要要件

- Docker および Docker Compose
- M5Stack Core2 デバイス (最低2台)
- M5Unit ENV III センサー
- Wi-Fiネットワーク
- (オプション) AWS EC2インスタンス (クラウドデプロイ用)

### ローカルデプロイメント

1. **リポジトリのクローン:**
```bash
git clone <repository-url>
cd iot-edge-computing-g8
```

2. **環境変数の設定:**
```bash
cd server
cp .env.example .env
# .envファイルをデータベース認証情報で編集
```

3. **Docker Composeでサービス起動:**
```bash
docker-compose up -d
```

4. **ダッシュボードへアクセス:**
```
http://localhost:8000
```

起動中のサービス:
- ダッシュボード: http://localhost:8000
- MQTT ブローカー: localhost:1883
- PostgreSQL: localhost:5432

### AWS EC2 デプロイメント

本番環境でのAWSデプロイ:

```bash
# EC2へビルドとデプロイ
./deploy-to-aws.sh <EC2_IP> <SSH_KEY_PATH>

# 例:
./deploy-to-aws.sh 50.16.142.67 iot-elderly-care-key.pem
```

詳細なデプロイ手順は [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) を参照してください。

### ファームウェアアップロード

`lib_shared/M5_IoT_Shared/SharedIoT.cpp` でMQTTブローカーIPを更新:

```cpp
const char* MQTT_HOST = "YOUR_SERVER_IP";  // サーバーIPに変更
```

各デバイスにファームウェアをアップロード:

```bash
# 転倒検知ユニット
cd firmware-fall && pio run --target upload

# 環境モニタリングユニット
cd ../firmware-env && pio run --target upload

# コミュニケーションユニット
cd ../firmware-comm && pio run --target upload
```

## 📊 MQTTトピック

システムは階層的なMQTTトピックを使用:

| トピック | デバイス | データ |
|---------|---------|--------|
| `home/user_belt/safety/alert` | 転倒検知 | 転倒アラート (G値 > 2.5) |
| `home/user_belt/safety/status` | 転倒検知 | ハートビート + バッテリー |
| `home/living_room/env/telemetry` | 環境モニター | 温度/湿度/気圧/WBGT |
| `home/living_room/env/status` | 環境モニター | ハートビート + バッテリー |
| `home/bedside/comm/button` | コミュニケーション | 緊急ボタン押下 |
| `home/bedside/comm/display` | コミュニケーション | 着信メッセージ (購読) |
| `home/bedside/comm/status` | コミュニケーション | ハートビート + バッテリー |

## 🔧 設定

### 環境変数 (.env)

```bash
# データベース設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=edgedevices
DB_USER=iot_user
DB_PASSWORD=your_secure_password

# MQTT ブローカー
MQTT_BROKER=localhost
MQTT_PORT=1883
```

### Wi-Fi設定

`lib_shared/M5_IoT_Shared/SharedIoT.cpp` を編集:

```cpp
const char* WIFI_SSID = "your-wifi-name";
const char* WIFI_PASS = "your-wifi-password";
const char* MQTT_HOST = "your-server-ip";
```

### Docker 自動再起動

docker-compose.yml で全サービスに `restart: unless-stopped` が設定されており、サーバー起動時に自動的に起動します。

Dockerが有効か確認:
```bash
systemctl is-enabled docker
```

## 📡 API エンドポイント

Flask サーバーが提供するREST APIエンドポイント:

- `GET /` - ダッシュボードホームページ
- `GET /api/heat/history?hours=6&limit=100` - 温度/湿度履歴
- `GET /api/commu/history?hours=24&emerg_only=false` - 通信イベント
- `GET /api/stats` - 24時間集計統計

## 🐳 Docker 管理コマンド

```bash
# 全サービス起動
docker-compose up -d

# ログ表示
docker-compose logs -f

# 特定サービスの再起動
docker-compose restart flask-server

# 全サービス停止
docker-compose down

# サービス状態確認
docker-compose ps
```

## 📁 プロジェクト構造

```
iot-edge-computing-g8/
├── firmware-fall/          # 転倒検知ファームウェア
├── firmware-env/           # 環境モニターファームウェア
├── firmware-comm/          # コミュニケーションユニットファームウェア
├── lib_shared/             # 共有IoTライブラリ (Wi-Fi, MQTT, ハートビート)
├── server/                 # Flask バックエンド + データベース
│   ├── app.py              # MQTT + WebSocket メインサーバー
│   ├── db_config.py        # PostgreSQL 接続プーリング
│   ├── schema.sql          # データベーススキーマ
│   ├── templates/          # HTML ダッシュボード
│   └── static/             # CSS + JavaScript
├── mosquitto/              # MQTT ブローカー設定
├── docker-compose.yml      # マルチコンテナオーケストレーション
├── deploy-to-aws.sh        # AWS デプロイスクリプト
└── DOCKER_DEPLOYMENT.md    # デプロイドキュメント
```

## 🔒 セキュリティ考慮事項

**本番環境チェックリスト:**
- [ ] PostgreSQL デフォルトパスワードの変更
- [ ] MQTT認証の有効化 (DOCKER_DEPLOYMENT.md参照)
- [ ] AWS セキュリティグループの設定 (ポート 22, 1883, 8000)
- [ ] ダッシュボードのHTTPS化 (リバースプロキシ追加)
- [ ] リポジトリから `.pem` ファイルの削除
- [ ] 全シークレットに環境変数を使用

## ⚠️ 技術的注意点

- **バッテリー表示:** 電圧 (3.2V-4.2V) を線形近似でパーセンテージ変換
- **音声アラート:** ブラウザで音声を有効にするにはユーザージェスチャーが必要 (「音声を有効にする」ボタンをクリック)
- **ヘルスチェック:** 40秒以上ハートビートがないデバイスはオフラインと判定
- **WBGT計算:** Stull式を使用した簡易屋内近似値
- **データベースプーリング:** 効率的なデータベースアクセスのための接続プール (5-20接続)

## 📖 ドキュメント

- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - 包括的デプロイガイド
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) - クイックリファレンス
- [CLAUDE.md](CLAUDE.md) - Claude Code用開発ガイド
- [server/db_cheatsheet.md](server/db_cheatsheet.md) - データベースクエリリファレンス

## 🎯 ユースケース

本システムの想定用途:
- **高齢者介護施設:** 中央ダッシュボードから複数の入居者を監視
- **在宅介護:** 家族が遠隔で高齢の親族を見守り
- **医療研究:** 環境および活動データの収集・分析
- **緊急対応:** 転倒やヘルプリクエストの迅速な通知システム

## 🚀 今後の拡張機能

- [ ] ダッシュボードでのWBGT表示・可視化
- [ ] モバイルアプリ (iOS/Android)
- [ ] マルチユーザー認証
- [ ] 屋外ユニット用GPS追跡
- [ ] 機械学習による転倒検知
- [ ] SMS/メール通知
- [ ] 履歴データエクスポート (CSV)
- [ ] 目視確認用カメラ統合

## 📜 ライセンス

This project is open source.

---

**開発環境:** M5Stack Core2, Python Flask, PostgreSQL, MQTT, Docker, AWS EC2

**デプロイメント:** http://50.16.142.67:8000
