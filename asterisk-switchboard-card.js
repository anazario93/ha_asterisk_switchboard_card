class AsteriskSwitchboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Please provide a valid Asterisk Switchboard card configuration.");
    }
    this._config = {
      title: "Asterisk Switchboard",
      ami_entity: "binary_sensor.ami_connected",
      columns: 3,
      show_unregistered: true,
      extensions: {},
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  _friendlyName(extension, entityBase) {
    const names = this._config.extensions || {};
    return names[extension] || names[entityBase] || `Extension ${extension}`;
  }

  _discoverExtensions() {
    if (!this._hass) return [];
    const entities = this._hass.states;
    const registeredIds = Object.keys(entities).filter(
      (id) => id.startsWith("binary_sensor.") && id.endsWith("_registered")
    );
    const found = new Map();

    for (const registeredId of registeredIds) {
      const entityBase = registeredId
        .slice("binary_sensor.".length)
        .replace(/_registered$/, "");
      const numberMatch = entityBase.match(/(\d+)(?:_\d+)?$/);
      if (!numberMatch) continue;
      const extension = numberMatch[1];
      const stateId = `sensor.${entityBase}_state`;
      const lineId = `sensor.${entityBase}_connected_line`;
      const registeredState = entities[registeredId];
      const stateEntity = entities[stateId];
      const lineEntity = entities[lineId];

      const candidate = {
        extension, entityBase, registeredId,
        stateId: entities[stateId] ? stateId : null,
        lineId: entities[lineId] ? lineId : null,
        registered: registeredState?.state === "on",
        state: stateEntity?.state ?? "Unknown",
        line: lineEntity?.state ?? "None",
      };
      const previous = found.get(extension);
      const candidateIsSimple = entityBase === extension;
      const previousIsSimple = previous?.entityBase === extension;
      if (!previous || (candidateIsSimple && !previousIsSimple)) found.set(extension, candidate);
    }

    return [...found.values()]
      .filter((item) => this._config.show_unregistered !== false || item.registered)
      .sort((a, b) => a.extension.localeCompare(b.extension, undefined, { numeric: true }));
  }

  _stateInfo(state, registered) {
    const normalized = String(state || "Unknown").toLowerCase();
    if (!registered) return { label: "Not registered", tone: "offline", icon: "mdi:phone-off" };
    if (normalized.includes("ring")) return { label: state, tone: "ringing", icon: "mdi:phone-ring" };
    if (normalized.includes("busy") || normalized.includes("in use")) return { label: state, tone: "busy", icon: "mdi:phone-in-talk" };
    if (normalized.includes("hold")) return { label: state, tone: "hold", icon: "mdi:phone-paused" };
    if (normalized.includes("not in use")) return { label: "Available", tone: "available", icon: "mdi:phone" };
    if (normalized.includes("unavailable") || normalized === "unknown") return { label: state, tone: "offline", icon: "mdi:phone-off" };
    return { label: state, tone: "neutral", icon: "mdi:phone" };
  }

  _escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    if (!this._hass) {
      this.shadowRoot.innerHTML = `<ha-card><div class="loading">Waiting for Home Assistant…</div></ha-card>`;
      return;
    }

    const entities = this._hass.states;
    const ami = entities[this._config.ami_entity || "binary_sensor.ami_connected"];
    const amiConnected = ami?.state === "on";
    const extensions = this._discoverExtensions();
    const counts = { available: 0, ringing: 0, busy: 0, offline: 0 };

    for (const item of extensions) {
      const info = this._stateInfo(item.state, item.registered);
      if (info.tone === "available") counts.available++;
      else if (info.tone === "ringing") counts.ringing++;
      else if (info.tone === "busy" || info.tone === "hold") counts.busy++;
      else if (info.tone === "offline") counts.offline++;
    }

    const extensionMarkup = extensions.length
      ? extensions.map((item) => {
          const info = this._stateInfo(item.state, item.registered);
          const name = this._friendlyName(item.extension, item.entityBase);
          const line = item.line && item.line !== "None" && item.line !== "unknown" && item.line !== "unavailable"
            ? `Connected line · ${this._escape(item.line)}`
            : "No active connected line";
          return `
            <article class="extension ${info.tone}">
              <div class="tile-top">
                <div class="phone-icon"><ha-icon icon="${info.icon}"></ha-icon></div>
                <div class="identity">
                  <div class="number">${this._escape(item.extension)}</div>
                  <div class="name">${this._escape(name)}</div>
                </div>
                <span class="registration ${item.registered ? "is-registered" : "is-unregistered"}">
                  <span class="dot"></span>${item.registered ? "Registered" : "Offline"}
                </span>
              </div>
              <div class="state-row"><span class="state-pill ${info.tone}">${this._escape(info.label)}</span></div>
              <div class="line">${line}</div>
              <div class="tile-actions">
                <button class="details" data-entity="${this._escape(item.stateId || item.registeredId)}">View details <span>↗</span></button>
              </div>
            </article>`;
        }).join("")
      : `<div class="empty">No Asterisk extension entities found.<br><span>Check that the integration is loaded and its Registered entities are enabled.</span></div>`;

    const columns = Math.min(6, Math.max(1, Number(this._config.columns) || 3));
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; width:100%; min-width:0; box-sizing:border-box; contain:content; }
        *, *::before, *::after { box-sizing:border-box; }
        ha-card { display:block; width:100%; max-width:100%; min-width:0; overflow:hidden;
          color:var(--primary-text-color); background:var(--ha-card-background,var(--card-background-color));
          border-radius:var(--ha-card-border-radius,12px); }
        .wrap { padding:16px; min-width:0; }
        .header { display:flex; align-items:center; gap:12px; min-width:0; margin-bottom:18px; }
        .brand-icon { width:44px; height:44px; flex:0 0 44px; display:grid; place-items:center;
          border-radius:12px; background:var(--secondary-background-color); color:var(--primary-text-color); }
        .brand-icon ha-icon { --mdc-icon-size:25px; }
        .heading { flex:1; min-width:0; }
        h2 { margin:0; font-size:var(--ha-font-size-xl,20px); font-weight:650; line-height:1.25; overflow-wrap:anywhere; }
        .subtitle { margin-top:4px; font-size:12px; letter-spacing:.09em; color:var(--secondary-text-color); }
        .connection { display:flex; align-items:center; gap:7px; flex:0 0 auto; padding:7px 10px;
          border-radius:999px; font-size:12px; font-weight:600; background:var(--secondary-background-color); }
        .connection .dot,.registration .dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
        .connection.online { color:var(--success-color,#2e9d63); }
        .connection.offline { color:var(--error-color,#db4437); }
        .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-bottom:20px; }
        .metric { min-width:0; padding:12px; border:1px solid var(--divider-color); border-radius:10px; }
        .metric-label { display:flex; align-items:center; gap:6px; color:var(--secondary-text-color); font-size:12px; }
        .metric-label ha-icon { --mdc-icon-size:17px; }
        .metric-value { margin-top:6px; font-size:25px; font-weight:700; line-height:1.1; font-variant-numeric:tabular-nums; }
        .metric.available .metric-value { color:var(--success-color,#2e9d63); }
        .metric.ringing .metric-value { color:var(--warning-color,#e5a000); }
        .metric.busy .metric-value { color:var(--error-color,#db4437); }
        .metric.offline .metric-value { color:var(--secondary-text-color); }
        .section-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 10px; }
        h3 { margin:0; font-size:14px; font-weight:650; letter-spacing:.04em; }
        .total { color:var(--secondary-text-color); font-size:12px; white-space:nowrap; }
        .extensions { display:grid; grid-template-columns:repeat(${columns},minmax(0,1fr)); gap:10px; min-width:0; }
        .extension { min-width:0; overflow:hidden; border:1px solid var(--divider-color); border-radius:11px; padding:12px; }
        .tile-top { display:flex; align-items:flex-start; gap:9px; min-width:0; }
        .phone-icon { flex:0 0 34px; width:34px; height:34px; display:grid; place-items:center; border-radius:9px; background:var(--secondary-background-color); }
        .phone-icon ha-icon { --mdc-icon-size:20px; }
        .available .phone-icon { color:var(--success-color,#2e9d63); }
        .ringing .phone-icon { color:var(--warning-color,#e5a000); }
        .busy .phone-icon,.hold .phone-icon { color:var(--error-color,#db4437); }
        .offline .phone-icon { color:var(--secondary-text-color); }
        .identity { flex:1; min-width:0; }
        .number { font-size:17px; line-height:1.2; font-weight:700; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
        .name { margin-top:3px; color:var(--secondary-text-color); font-size:12px; line-height:1.35; overflow-wrap:anywhere; }
        .registration { display:flex; align-items:center; gap:5px; max-width:100%; font-size:10px; white-space:nowrap; color:var(--secondary-text-color); }
        .registration.is-registered { color:var(--success-color,#2e9d63); }
        .registration.is-unregistered { color:var(--error-color,#db4437); }
        .registration .dot { width:6px; height:6px; flex:0 0 6px; }
        .state-row { margin-top:12px; }
        .state-pill { display:inline-block; max-width:100%; padding:5px 8px; border-radius:6px; font-size:11px; font-weight:650; overflow-wrap:anywhere; background:var(--secondary-background-color); color:var(--secondary-text-color); }
        .state-pill.available { color:var(--success-color,#2e9d63); background:color-mix(in srgb,var(--success-color,#2e9d63) 12%,transparent); }
        .state-pill.ringing { color:var(--warning-color,#e5a000); background:color-mix(in srgb,var(--warning-color,#e5a000) 14%,transparent); }
        .state-pill.busy,.state-pill.hold { color:var(--error-color,#db4437); background:color-mix(in srgb,var(--error-color,#db4437) 12%,transparent); }
        .state-pill.offline { color:var(--secondary-text-color); }
        .line { margin-top:10px; min-height:16px; font-size:11px; line-height:1.4; color:var(--secondary-text-color); overflow-wrap:anywhere; }
        .tile-actions { margin-top:10px; padding-top:9px; border-top:1px solid var(--divider-color); }
        button.details { width:100%; display:flex; justify-content:space-between; align-items:center; gap:8px; padding:0;
          border:0; background:transparent; color:var(--primary-color); font:inherit; font-size:12px; text-align:left; cursor:pointer; }
        button.details:focus-visible { outline:2px solid var(--primary-color); outline-offset:3px; border-radius:3px; }
        .empty { grid-column:1/-1; padding:22px 12px; border:1px dashed var(--divider-color); border-radius:10px; text-align:center; color:var(--secondary-text-color); font-size:13px; line-height:1.6; }
        .empty span { font-size:12px; }
        .footer { margin-top:14px; padding-top:10px; border-top:1px solid var(--divider-color); color:var(--secondary-text-color); font-size:11px; display:flex; justify-content:space-between; gap:8px; }
        .loading { padding:20px; color:var(--secondary-text-color); }
        @media (max-width:700px) {
          .wrap { padding:12px; } .metrics { gap:6px; } .metric { padding:9px; }
          .metric-label { gap:4px; font-size:10px; } .metric-label ha-icon { --mdc-icon-size:15px; }
          .metric-value { font-size:21px; } .extensions { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .connection { padding:6px 8px; font-size:11px; }
        }
        @media (max-width:380px) {
          .subtitle { font-size:10px; } .brand-icon { width:38px; height:38px; flex-basis:38px; }
          .connection { font-size:0; gap:0; padding:8px; } .connection .dot { width:8px; height:8px; }
          .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
      </style>
      <ha-card><div class="wrap">
        <div class="header">
          <div class="brand-icon"><ha-icon icon="mdi:phone-settings"></ha-icon></div>
          <div class="heading"><h2>${this._escape(this._config.title)}</h2><div class="subtitle">PBX SWITCHBOARD · LIVE STATUS</div></div>
          <div class="connection ${amiConnected ? "online" : "offline"}"><span class="dot"></span>${ami ? (amiConnected ? "Connected" : "Disconnected") : "AMI entity missing"}</div>
        </div>
        <div class="metrics">
          <div class="metric available"><div class="metric-label"><ha-icon icon="mdi:phone-check"></ha-icon>Available</div><div class="metric-value">${counts.available}</div></div>
          <div class="metric ringing"><div class="metric-label"><ha-icon icon="mdi:phone-ring"></ha-icon>Ringing</div><div class="metric-value">${counts.ringing}</div></div>
          <div class="metric busy"><div class="metric-label"><ha-icon icon="mdi:phone-in-talk"></ha-icon>In use</div><div class="metric-value">${counts.busy}</div></div>
          <div class="metric offline"><div class="metric-label"><ha-icon icon="mdi:phone-off"></ha-icon>Unavailable</div><div class="metric-value">${counts.offline}</div></div>
        </div>
        <div class="section-heading"><h3>EXTENSIONS</h3><span class="total">${extensions.length} extension${extensions.length === 1 ? "" : "s"}</span></div>
        <div class="extensions">${extensionMarkup}</div>
        <div class="footer"><span>${amiConnected ? "Asterisk Manager Interface online" : "Check the Asterisk AMI connection"}</span><span>${extensions.length} detected</span></div>
      </div></ha-card>`;

    this.shadowRoot.querySelectorAll("button.details").forEach((button) => {
      button.addEventListener("click", () => {
        const entityId = button.dataset.entity;
        if (!entityId) return;
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          bubbles: true, composed: true, detail: { entityId },
        }));
      });
    });
  }

  static getConfigElement() { return document.createElement("asterisk-switchboard-card-editor"); }
  static getStubConfig() {
    return { title: "Asterisk Switchboard", ami_entity: "binary_sensor.ami_connected", columns: 3 };
  }
}
customElements.define("asterisk-switchboard-card", AsteriskSwitchboardCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "asterisk-switchboard-card",
  name: "Asterisk Switchboard Card",
  description: "Responsive live status dashboard for the TECH7Fox Asterisk integration.",
  preview: true,
});
