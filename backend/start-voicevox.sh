#!/bin/bash
# VOICEVOX Engine（ローカル音声合成サーバー）を起動する
# 起動先: http://localhost:50021
# 本体は容量の都合でリポジトリ外（Gドライブ）に置いてある
"/g/マイドライブ/AI-project/ai-fortune/voicevox_engine/extracted/run.exe" &
disown
echo "VOICEVOX Engine starting on http://localhost:50021 (initial model load may take a few seconds)"
