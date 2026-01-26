class GoogleMapsCarCardCadu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        position: relative;
      }
      #map {
        width: 100%;
        height: 450px; /* Padrao para dispositivos moveis */
      }

      @media (min-width: 768px) {
        #map {
          height: 600px; /* Altura para dispositivos maiores (computador) */
        }
      }
      .info-box {
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 2px 5px;
        border-radius: 3px;
        display: inline-block;
        white-space: nowrap;
        transform: translate(-50%, -100%);
        position: absolute;
        text-align: center;
      }
      .info-box .arrow-box {
        font-size: 15px;
      }
      .info-box .velocidade {
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 24px; /* Ajuste conforme necessario */
      }
      .info-box .altitude {
        font-size: 12px;
      }
      .map-controls {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        padding: 8px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 2;
      }
      .map-controls label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      .map-controls .entity-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    `;
    this.shadowRoot.appendChild(style);
    this.mapContainer = document.createElement("div");
    this.mapContainer.id = "map";
    this.shadowRoot.appendChild(this.mapContainer);
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "map-controls";
    this.shadowRoot.appendChild(this.controlsContainer);
    this.markers = {}; // Armazena marcadores por entidade
    this.infoBoxes = {}; // Armazena InfoBoxes por entidade
    this.lastPositions = {}; // Armazena a ultima posicao de cada entidade
    this._uiState = {
      trafficEnabled: false,
      nightModeEnabled: false,
      followEnabled: false,
      entityVisibility: {},
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (this._map && this._config) {
      this._updateMap();
      this._applyNightMode();
      this._toggleTrafficLayer();
    }
  }

  setConfig(config) {
    if (!config.entities || !config.api_key) {
      throw new Error("Configuracao invalida");
    }
    this._config = {
      ...config,
      transito: typeof config.transito === "string" ? config.transito : null,
      modo_noturno: typeof config.modo_noturno === "string" ? config.modo_noturno : null,
      follow_entity:
        typeof config.follow_entity === "string" ? config.follow_entity : null,
    };
    this._uiState.trafficEnabled = false;
    this._uiState.nightModeEnabled = false;
    this._uiState.followEnabled = false;
    this._initializeEntityVisibility();
    if (!window.google || !window.google.maps) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this._config.api_key}`;
      script.onload = () => {
        this._initializeMap();
      };
      document.head.appendChild(script);
    } else {
      this._initializeMap();
    }
  }

  getCardSize() {
    return 6;
  }

  _initializeMap() {
    this._map = new google.maps.Map(this.mapContainer, {
      center: { lat: -30.0277, lng: -51.2287 }, // Exemplo inicial, sera ajustado
      zoom: 17, // Zoom inicial
      streetViewControl: false, // Desabilita o controle de Street View
    });
    this._applyNightMode();
    this._renderControls();

    this._config.entities.forEach((entityConfig) => {
      this._addOrUpdateMarker(entityConfig);
    });

    if (this._shouldFollow()) {
      this._fitMapBounds();
    }

    this.trafficLayer = new google.maps.TrafficLayer(); // Define a camada de transito
    this._toggleTrafficLayer();
  }

  _updateMap() {
    this._config.entities.forEach((entityConfig) => {
      this._addOrUpdateMarker(entityConfig);
    });

    if (this._shouldFollow()) {
      this._fitMapBounds();
    }
  }

  _shouldFollow() {
    if (this._config.follow_entity) {
      const followEntity = this._hass.states[this._config.follow_entity];
      return followEntity && followEntity.state === "on";
    }
    return this._uiState.followEnabled;
  }

  _applyNightMode() {
    const nightModeStyle = [
      { elementType: "geometry", stylers: [{ color: "#212121" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
      {
        featureType: "administrative",
        elementType: "geometry",
        stylers: [{ color: "#757575" }],
      },
      {
        featureType: "administrative.country",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9e9e9e" }],
      },
      {
        featureType: "administrative.land_parcel",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#bdbdbd" }],
      },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#181818" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#616161" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#1b1b1b" }],
      },
      { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
      {
        featureType: "road.arterial",
        elementType: "geometry",
        stylers: [{ color: "#373737" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#3c3c3c" }],
      },
      {
        featureType: "road.highway.controlled_access",
        elementType: "geometry",
        stylers: [{ color: "#4e4e4e" }],
      },
      {
        featureType: "road.local",
        elementType: "labels.text.fill",
        stylers: [{ color: "#616161" }],
      },
      { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
    ];

    const configNightMode = this._config.modo_noturno;
    const nightMode =
      typeof configNightMode === "string"
        ? this._hass.states[configNightMode]?.state === "on"
        : this._uiState.nightModeEnabled;
    this._map.setOptions({
      styles: nightMode ? nightModeStyle : [],
    });
  }

  _toggleTrafficLayer() {
    const configTraffic = this._config.transito;
    const trafficEnabled =
      typeof configTraffic === "string"
        ? this._hass.states[configTraffic]?.state === "on"
        : this._uiState.trafficEnabled;
    if (trafficEnabled) {
      this.trafficLayer.setMap(this._map);
    } else {
      this.trafficLayer.setMap(null);
    }
  }

  _addOrUpdateMarker(entityConfig) {
    const entity = this._hass.states[entityConfig.entity];
    const condition = entityConfig.condition
      ? this._hass.states[entityConfig.condition]
      : null;
    const conditionMet = entityConfig.condition
      ? condition && condition.state === "on"
      : this._uiState.entityVisibility[entityConfig.entity] !== false;
    if (entity && entity.state !== "unavailable" && conditionMet) {
      const location = new google.maps.LatLng(
        entity.attributes.latitude,
        entity.attributes.longitude
      );
      let marker = this.markers[entityConfig.entity];
      const infoBoxText = this._getInfoBoxText(entityConfig);

      // Calcular a direcao da seta
      let rotation;
      const lastPosition = this.lastPositions[entityConfig.entity];

      let deltaX = 0;
      let deltaY = 0;

      const speed =
        entityConfig.velocidade && this._hass.states[entityConfig.velocidade]
          ? parseFloat(this._hass.states[entityConfig.velocidade].state).toFixed(0)
          : 0;

      if (lastPosition) {
        deltaX = location.lng() - lastPosition.lng;
        deltaY = location.lat() - lastPosition.lat;
        if ((Math.abs(deltaX) > 0.00001 || Math.abs(deltaY) > 0.00001) && speed > 0) {
          rotation = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        } else {
          rotation = lastPosition.rotation;
        }
      } else {
        rotation = 999; // Valor inicial para rotacao
      }

      const arrow = this._getArrowFromRotation(rotation);
      this.lastPositions[entityConfig.entity] = {
        lat: location.lat(),
        lng: location.lng(),
        rotation,
      };

      const markerTitle = this._getEntityDisplayName(entityConfig, entity);

      if (!marker) {
        const icon = {
          url: entityConfig.image || entity.attributes.entity_picture || "",
          scaledSize: new google.maps.Size(60, 60),
          anchor: new google.maps.Point(30, 30),
        };

        marker = new google.maps.Marker({
          position: location,
          map: this._map,
          title: markerTitle,
          icon: icon,
        });

        this.markers[entityConfig.entity] = marker;
      } else {
        marker.setPosition(location);
        marker.setTitle(markerTitle);
      }

      // Remove existing InfoBox if it exists
      if (this.infoBoxes[entityConfig.entity]) {
        this.infoBoxes[entityConfig.entity].setMap(null);
      }

      // Add new InfoBox
      const infoBox = new google.maps.OverlayView();
      infoBox.onAdd = function () {
        const div = document.createElement("div");
        div.className = "info-box";
        div.innerHTML = `
          <div class="arrow-box">
            ${arrow} <!-- seta -->
          </div>
          ${infoBoxText}
        `;
        // <br> ${rotation} - ${deltaX} - ${deltaY}
        this.div_ = div;
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(div);
      };
      infoBox.draw = function () {
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(location);
        const div = this.div_;
        div.style.left = `${position.x}px`;
        div.style.top = `${position.y - 20}px`; // Ajustar conforme necessario para posicionar acima do marcador
      };
      infoBox.onRemove = function () {
        this.div_.parentNode.removeChild(this.div_);
        this.div_ = null;
      };
      infoBox.setMap(this._map);

      // Store the new InfoBox
      this.infoBoxes[entityConfig.entity] = infoBox;

      // Ajustar o centro do mapa se a opcao de seguir estiver ativada
      if (this._shouldFollow()) {
        this._map.setCenter(location);
      }
    } else {
      if (this.markers[entityConfig.entity]) {
        this.markers[entityConfig.entity].setMap(null);
        delete this.markers[entityConfig.entity];
      }
      if (this.infoBoxes[entityConfig.entity]) {
        this.infoBoxes[entityConfig.entity].setMap(null);
        delete this.infoBoxes[entityConfig.entity];
      }
    }
  }

  _initializeEntityVisibility() {
    if (!this._config || !this._config.entities) {
      return;
    }
    this._config.entities.forEach((entityConfig) => {
      if (!(entityConfig.entity in this._uiState.entityVisibility)) {
        this._uiState.entityVisibility[entityConfig.entity] = true;
      }
    });
  }

  _renderControls() {
    this.controlsContainer.innerHTML = "";

    const hasUiTraffic = !this._config.transito || typeof this._config.transito !== "string";
    const hasUiNightMode =
      !this._config.modo_noturno || typeof this._config.modo_noturno !== "string";
    const hasUiFollow =
      !this._config.follow_entity || typeof this._config.follow_entity !== "string";

    if (hasUiTraffic) {
      const trafficLabel = document.createElement("label");
      const trafficCheckbox = document.createElement("input");
      trafficCheckbox.type = "checkbox";
      trafficCheckbox.checked = this._uiState.trafficEnabled;
      trafficCheckbox.addEventListener("change", () => {
        this._uiState.trafficEnabled = trafficCheckbox.checked;
        this._toggleTrafficLayer();
      });
      trafficLabel.appendChild(trafficCheckbox);
      trafficLabel.appendChild(document.createTextNode("Transito"));
      this.controlsContainer.appendChild(trafficLabel);
    }

    if (hasUiNightMode) {
      const nightLabel = document.createElement("label");
      const nightCheckbox = document.createElement("input");
      nightCheckbox.type = "checkbox";
      nightCheckbox.checked = this._uiState.nightModeEnabled;
      nightCheckbox.addEventListener("change", () => {
        this._uiState.nightModeEnabled = nightCheckbox.checked;
        this._applyNightMode();
      });
      nightLabel.appendChild(nightCheckbox);
      nightLabel.appendChild(document.createTextNode("Modo noturno"));
      this.controlsContainer.appendChild(nightLabel);
    }

    if (hasUiFollow) {
      const followLabel = document.createElement("label");
      const followCheckbox = document.createElement("input");
      followCheckbox.type = "checkbox";
      followCheckbox.checked = this._uiState.followEnabled;
      followCheckbox.addEventListener("change", () => {
        this._uiState.followEnabled = followCheckbox.checked;
        if (this._shouldFollow()) {
          this._fitMapBounds();
        }
      });
      followLabel.appendChild(followCheckbox);
      followLabel.appendChild(document.createTextNode("Seguir"));
      this.controlsContainer.appendChild(followLabel);
    }

    this._config.entities.forEach((entityConfig) => {
      if (entityConfig.condition) {
        return;
      }
      const entityState = this._hass?.states?.[entityConfig.entity];
      const entityLabel = this._getEntityDisplayName(entityConfig, entityState);
      const entityToggle = document.createElement("label");
      entityToggle.className = "entity-toggle";
      const entityCheckbox = document.createElement("input");
      entityCheckbox.type = "checkbox";
      entityCheckbox.checked = this._uiState.entityVisibility[entityConfig.entity] !== false;
      entityCheckbox.addEventListener("change", () => {
        this._uiState.entityVisibility[entityConfig.entity] = entityCheckbox.checked;
        this._addOrUpdateMarker(entityConfig);
      });
      entityToggle.appendChild(entityCheckbox);
      entityToggle.appendChild(document.createTextNode(entityLabel));
      this.controlsContainer.appendChild(entityToggle);
    });
  }

  _getArrowFromRotation(rotation) {
    if (rotation >= -22.5 && rotation < 22.5) return "&rarr;";
    if (rotation >= 22.5 && rotation < 67.5) return "&nearr;";
    if (rotation >= 67.5 && rotation < 112.5) return "&uarr;";
    if (rotation >= 112.5 && rotation < 157.5) return "&nwarr;";
    if ((rotation >= 157.5 && rotation < 500) || rotation < -157.5) return "&larr;";
    if (rotation >= -157.5 && rotation < -112.5) return "&swarr;";
    if (rotation >= -112.5 && rotation < -67.5) return "&darr;";
    if (rotation >= -67.5 && rotation < -22.5) return "&searr;";
    return "&bull;"; // Default to dot
  }

  _getEntityDisplayName(entityConfig, entityState) {
    if (entityConfig.name) {
      return entityConfig.name;
    }
    return entityState?.attributes?.friendly_name || entityConfig.entity;
  }

  _getInfoBoxText(entityConfig) {
    let infoBoxText = "";

    if (entityConfig.velocidade && this._hass.states[entityConfig.velocidade]) {
      const speed = parseFloat(this._hass.states[entityConfig.velocidade].state).toFixed(0);
      infoBoxText += `<div class="velocidade"> ${speed} km/h</div>`;
    }
    if (entityConfig.altitude && this._hass.states[entityConfig.altitude]) {
      const altitude = parseFloat(this._hass.states[entityConfig.altitude].state).toFixed(0);
      infoBoxText += `<div class="altitude"> &#9650; ${altitude} m</div>`;
    }

    return infoBoxText;
  }

  _fitMapBounds() {
    const bounds = new google.maps.LatLngBounds();
    Object.values(this.markers).forEach((marker) => {
      bounds.extend(marker.getPosition());
    });

    this._map.fitBounds(bounds);

    // Listener para apos ajuste dos limites
    google.maps.event.addListenerOnce(this._map, "bounds_changed", () => {
      const maxZoom = 18; // Define o zoom maximo que voce deseja permitir
      if (this._map.getZoom() > maxZoom) {
        this._map.setZoom(maxZoom);
      }
    });
  }
}

class GoogleMapsCarCardCaduEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._rendered) {
      this._syncFormData();
    } else if (this._config) {
      this._render();
    }
  }

  _render() {
    this._rendered = true;
    this.innerHTML = "";
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = { ...this._config };
    form.schema = this._buildSchema();
    form.computeLabel = (schema) => schema.label || schema.name;
    form.addEventListener("value-changed", (event) => {
      this._dispatchConfigChanged(event.detail.value);
    });
    this.appendChild(form);
    this._form = form;
  }

  _syncFormData() {
    if (this._form) {
      this._form.hass = this._hass;
      this._form.data = { ...this._config };
    }
  }

  _buildSchema() {
    return [
      {
        name: "api_key",
        label: "Google Maps API Key",
        required: true,
        selector: { text: {} },
      },
      {
        name: "follow_entity",
        label: "Entidade para seguir (booleana, opcional)",
        selector: { entity: { domain: "input_boolean" } },
      },
      {
        name: "modo_noturno",
        label: "Entidade modo noturno (opcional)",
        selector: { entity: { domain: "input_boolean" } },
      },
      {
        name: "transito",
        label: "Entidade transito (opcional)",
        selector: { entity: { domain: "input_boolean" } },
      },
      {
        name: "entities",
        label: "Entidades",
        selector: {
          object: {
            multiple: true,
            fields: [
              {
                name: "entity",
                label: "Entidade",
                required: true,
                selector: { entity: {} },
              },
              {
                name: "name",
                label: "Nome personalizado (opcional)",
                selector: { text: {} },
              },
              {
                name: "condition",
                label: "Condicao (opcional)",
                selector: { entity: { domain: "input_boolean" } },
              },
              {
                name: "image",
                label: "Imagem (opcional)",
                selector: { text: {} },
              },
              {
                name: "velocidade",
                label: "Sensor de velocidade (opcional)",
                selector: { entity: {} },
              },
              {
                name: "altitude",
                label: "Sensor de altitude (opcional)",
                selector: { entity: {} },
              },
            ],
          },
        },
      },
    ];
  }

  _dispatchConfigChanged(config) {
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("google-maps-car-card-cadu", GoogleMapsCarCardCadu);
customElements.define("google-maps-car-card-cadu-editor", GoogleMapsCarCardCaduEditor);

GoogleMapsCarCardCadu.getConfigElement = function () {
  return document.createElement("google-maps-car-card-cadu-editor");
};

GoogleMapsCarCardCadu.getStubConfig = function () {
  return {
    api_key: "",
    follow_entity: "",
    entities: [],
  };
};

window.customCards = window.customCards || [];
window.customCards.push({
  type: "google-maps-car-card-cadu",
  name: "Google Maps Car Card Cadu",
  description: "Exibe dispositivos no Google Maps com InfoBox personalizado.",
});
