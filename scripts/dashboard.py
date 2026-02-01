#!/usr/bin/env python3
"""
Kripto İzleme Paneli (Streamlit).
BTC, ETH, SOL vb. kripto varlıklar için metrikler, grafikler, config, audit log.
WEB_ADMIN_SECRET .env'de tanımlıysa giriş gerekir.
Çalıştırma: ./scripts/run_dashboard.sh  (veya streamlit run scripts/dashboard.py)
"""
import sys
import os
import time
from pathlib import Path

ROOT = os.environ.get("POLYMARKET_ROOT") or str(Path(__file__).resolve().parent.parent)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import streamlit as st
import pandas as pd

from src.config_loader import load_env, load_yaml, save_risk_params, save_monitoring_alerts
from src.monitoring import get_metrics, get_metrics_history, get_event_history
from src.manual_review_queue import get_all, approve, reject
from src.execution_mode import get_mode, set_mode
from src.alerts import get_alert_history
from src.audit_log import read_audit_log

st.set_page_config(page_title="Kripto İzleme", layout="wide")
env = load_env()
secret = env.get("WEB_ADMIN_SECRET")

if secret and not st.session_state.get("authenticated"):
    st.title("Giriş")
    pwd = st.text_input("Şifre", type="password", key="admin_pwd")
    if st.button("Giriş"):
        if pwd == secret:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Yanlış şifre.")
    st.stop()

# Sidebar
with st.sidebar:
    if secret:
        if st.button("Çıkış", key="logout"):
            st.session_state["authenticated"] = False
            st.rerun()
    st.radio("Sayfa", ["Kripto", "Kripto Dashboard", "Manuel kuyruk", "Uyarılar ve geçmiş", "Config", "Audit log"], key="page", horizontal=False)
    auto_refresh = st.checkbox("Otomatik yenileme (10 sn)", value=st.session_state.get("auto_refresh", False), key="auto_refresh_cb")
    st.session_state["auto_refresh"] = auto_refresh

page = st.session_state.get("page", "Kripto")

def render_kripto():
    """Kripto varlıklar sayfası — BTC, ETH, SOL listesi."""
    st.title("Kripto Varlıklar")
    cfg = load_yaml("crypto_assets")
    assets = cfg.get("assets") or []
    if not assets:
        st.warning("config/crypto_assets.yaml içinde varlık tanımı yok.")
        return
    st.caption("config/crypto_assets.yaml — izleme ve kontrol kapsamındaki varlıklar.")
    df = pd.DataFrame(assets)
    st.dataframe(df, width="stretch", hide_index=True)
    st.subheader("Özet")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Varlık sayısı", len(assets))
    with col2:
        symbols = ", ".join(a.get("symbol", "") for a in assets)
        st.text("Semboller: " + (symbols or "—"))
    with col3:
        st.caption("Fiyat/bakiye için exchange API entegrasyonu ileride eklenecek.")


def render_dashboard():
    st.title("Kripto İzleme Paneli")
    mode_data = get_mode()
    mode = env.get("EXECUTION_MODE", mode_data.get("EXECUTION_MODE", "paper"))
    new_mode = st.selectbox("İşlem modu", ["paper", "live"], index=0 if mode == "paper" else 1, key="exec_mode")
    if new_mode != mode:
        set_mode(new_mode)
        st.rerun()
    st.info(f"**İşlem modu:** {mode.upper()}")

    m = get_metrics()
    col1, col2, col3, col4, col5, col6 = st.columns(6)
    with col1:
        st.metric("Fırsat/dk", m.get("opportunities_per_min", 0))
    with col2:
        st.metric("Execution/dk", m.get("executions_per_min", 0))
    with col3:
        st.metric("Fırsat (toplam)", m.get("opportunities_count", 0))
    with col4:
        st.metric("Execution (toplam)", m.get("executions_count", 0))
    with col5:
        st.metric("Başarı oranı %", round(m.get("execution_success_rate", 0), 1))
    with col6:
        st.metric("Toplam PnL (USD)", round(m.get("total_pnl", 0), 2))
    col7, col8 = st.columns(2)
    with col7:
        st.metric("Drawdown %", round(m.get("drawdown_pct", 0), 1))
    with col8:
        st.metric("Ort. gecikme (ms)", round(m.get("avg_latency_ms", 0), 1))

    # Grafikler
    history = get_metrics_history(200)
    if history:
        df = pd.DataFrame(history)
        if "ts" in df.columns:
            df["ts"] = pd.to_datetime(df["ts"], errors="coerce")
            df = df.dropna(subset=["ts"])
        if not df.empty:
            st.subheader("Zaman serisi")
            tab1, tab2, tab3 = st.tabs(["PnL (USD)", "Drawdown %", "Gecikme (ms)"])
            with tab1:
                if "total_pnl" in df.columns:
                    st.line_chart(df.set_index("ts")[["total_pnl"]])
            with tab2:
                if "drawdown_pct" in df.columns:
                    st.line_chart(df.set_index("ts")[["drawdown_pct"]])
            with tab3:
                if "avg_latency_ms" in df.columns:
                    st.line_chart(df.set_index("ts")[["avg_latency_ms"]])
    else:
        st.caption("Grafik verisi yok (pipeline çalıştıkça dolacak).")

    alerts_list = m.get("alerts") or []
    if alerts_list:
        st.subheader("Uyarılar")
        for msg in alerts_list:
            st.warning(msg)
    else:
        st.caption("Uyarı yok (eşikler: config/monitoring.yaml)")

    st.subheader("Son olaylar")
    events = get_event_history(30)
    if events:
        rows = [{"Zaman": e.get("ts"), "Tür": e.get("type"), "Detay": str(e.get("detail", {}))} for e in events]
        st.dataframe(pd.DataFrame(rows), width="stretch")
    else:
        st.caption("Olay kaydı yok (pipeline çalıştıkça dolacak).")


def render_queue():
    st.title("Manuel kuyruk")
    items = get_all()
    pending = [x for x in items if x.get("status") == "pending"]
    if not pending:
        st.write("Bekleyen kayıt yok.")
    else:
        for x in pending:
            with st.expander(f"#{x.get('id')} — {str(x.get('market_a', ''))[:50]}..."):
                st.json(x)
                if st.button("Onayla", key=f"ok_{x.get('id')}"):
                    approve(x["id"])
                    st.rerun()
                if st.button("Reddet", key=f"no_{x.get('id')}"):
                    reject(x["id"])
                    st.rerun()
    st.caption(f"Toplam kayıt: {len(items)} (bekleyen: {len(pending)})")


def render_alerts():
    st.title("Uyarılar ve geçmiş")
    m = get_metrics()
    st.subheader("Anlık uyarılar")
    alerts_list = m.get("alerts") or []
    if alerts_list:
        for msg in alerts_list:
            st.warning(msg)
    else:
        st.write("Şu an uyarı yok.")
    st.subheader("Uyarı geçmişi (son 50)")
    hist = get_alert_history(50)
    if hist:
        st.dataframe(pd.DataFrame(hist), width="stretch")
    else:
        st.write("Kayıt yok.")


def render_config():
    st.title("Config")
    cfg_crypto = load_yaml("crypto_assets")
    assets = cfg_crypto.get("assets") or []
    if assets:
        st.subheader("Kripto varlıklar (ana kapsam)")
        st.caption("config/crypto_assets.yaml — BTC, ETH, SOL vb. izleme/kontrol.")
        st.dataframe(pd.DataFrame(assets), width="stretch", hide_index=True)
    cfg_risk = load_yaml("risk_params")
    cfg_mon = load_yaml("monitoring")
    alerts_cfg = cfg_mon.get("alerts") or {}
    with st.form("config_form"):
        st.subheader("risk_params.yaml")
        r1, r2 = st.columns(2)
        with r1:
            min_margin = st.number_input("min_profit_margin_usd", value=float(cfg_risk.get("min_profit_margin_usd", 0.05)), step=0.01, format="%.2f")
            min_liq = st.number_input("min_liquidity_per_leg_usd", value=float(cfg_risk.get("min_liquidity_per_leg_usd", 100)), step=10.0)
        with r2:
            max_pos = st.number_input("max_position_usd", value=float(cfg_risk.get("max_position_usd", 5000)), step=100.0)
            max_dd = st.number_input("max_drawdown_pct", value=float(cfg_risk.get("max_drawdown_pct", 15)), step=1.0)
        st.subheader("monitoring.yaml (alerts)")
        mon1, mon2 = st.columns(2)
        with mon1:
            drawdown_gt = st.number_input("drawdown_pct_gt", value=int(alerts_cfg.get("drawdown_pct_gt", 15)), step=1)
        with mon2:
            rate_lt = st.number_input("execution_rate_lt", value=int(alerts_cfg.get("execution_rate_lt", 30)), step=1)
        if st.form_submit_button("Kaydet"):
            save_risk_params({"min_profit_margin_usd": min_margin, "min_liquidity_per_leg_usd": min_liq, "max_position_usd": max_pos, "max_drawdown_pct": max_dd})
            save_monitoring_alerts({"drawdown_pct_gt": drawdown_gt, "execution_rate_lt": rate_lt})
            st.success("Kaydedildi.")
            st.rerun()
    st.caption("API key ve cüzdan bilgisi panelde gösterilmez.")


def render_audit():
    st.title("Audit log")
    action_filter = st.selectbox("Aksiyon filtresi", ["Tümü", "execution_mode_change", "config_change", "queue_approve", "queue_reject"], key="audit_filter")
    limit = st.slider("Kayıt sayısı", 20, 300, 100)
    filt = None if action_filter == "Tümü" else action_filter
    entries = read_audit_log(limit=limit, action_filter=filt)
    if entries:
        rows = []
        for e in entries:
            rows.append({"Zaman": e.get("ts"), "Aksiyon": e.get("action"), "Detay": str(e.get("details", {}))})
        st.dataframe(pd.DataFrame(rows), width="stretch")
    else:
        st.write("Kayıt yok.")


if page == "Kripto":
    render_kripto()
elif page == "Kripto Dashboard":
    render_dashboard()
elif page == "Manuel kuyruk":
    render_queue()
elif page == "Uyarılar ve geçmiş":
    render_alerts()
elif page == "Config":
    render_config()
elif page == "Audit log":
    render_audit()

if st.session_state.get("auto_refresh"):
    time.sleep(10)
    st.rerun()
