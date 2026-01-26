class GoogleMapsCardCadu1 extends HTMLElement {
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
    if (!config.entities || !config.api_key || !config.follow_entity) {
      throw new Error("Configuracao invalida");
    }
    this._config = {
      ...config,
      transito: typeof config.transito === "string" ? config.transito : null,
      modo_noturno: typeof config.modo_noturno === "string" ? config.modo_noturno : null,
    };
    this._uiState.trafficEnabled = false;
    this._uiState.nightModeEnabled = false;
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
    const followEntity = this._hass.states[this._config.follow_entity];
    return followEntity && followEntity.state === "on";
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

      if (!marker) {
        const icon = {
          url: entityConfig.image || entity.attributes.entity_picture || "",
          scaledSize: new google.maps.Size(60, 60),
          anchor: new google.maps.Point(30, 30),
        };

        marker = new google.maps.Marker({
          position: location,
          map: this._map,
          title: entity.attributes.friendly_name,
          icon: icon,
        });

        this.markers[entityConfig.entity] = marker;
      } else {
        marker.setPosition(location);
        marker.setTitle(entity.attributes.friendly_name);
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

    this._config.entities.forEach((entityConfig) => {
      if (entityConfig.condition) {
        return;
      }
      const entityState = this._hass?.states?.[entityConfig.entity];
      const entityLabel = entityState?.attributes?.friendly_name || entityConfig.entity;
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

customElements.define("google-maps-card-cadu1", GoogleMapsCardCadu1);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "google-maps-card-cadu1",
  name: "Google Maps Card Cadu1",
  description: "Exibe dispositivos no Google Maps com InfoBox personalizado.",
});
