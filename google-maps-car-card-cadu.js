const ENTITY_FIELD_ORDER = [
  "entity",
  "name",
  "image",
  "velocidade",
  "altitude",
  "condition",
];

function normalizeEntityConfig(entityConfig) {
  if (!entityConfig || typeof entityConfig !== "object" || Array.isArray(entityConfig)) {
    return {
      entity: "",
      name: "",
      image: "",
      velocidade: "",
      altitude: "",
      condition: "",
    };
  }
  
  try {
    const numericKeys = Object.keys(entityConfig).filter((key) => /^\d+$/.test(key));
    
    // Criar novo objeto normalizado, preservando campos nomeados existentes
    const normalized = {
      entity: entityConfig.entity || "",
      name: entityConfig.name || "",
      image: entityConfig.image || "",
      image_rotated: entityConfig.image_rotated || "",
      velocidade: entityConfig.velocidade || "",
      altitude: entityConfig.altitude || "",
      condition: entityConfig.condition || "",
    };
    
    // Preservar outros campos que possam existir
    Object.keys(entityConfig).forEach((key) => {
      if (!/^\d+$/.test(key) && normalized[key] === undefined) {
        normalized[key] = entityConfig[key];
      }
    });
    
    // Converter chaves numéricas para campos nomeados
    if (numericKeys.length > 0) {
      numericKeys.forEach((key) => {
        const index = Number(key);
        if (isNaN(index) || index < 0 || index >= ENTITY_FIELD_ORDER.length) {
          return;
        }
        const fieldName = ENTITY_FIELD_ORDER[index];
        if (fieldName) {
          // Só sobrescreve se o campo nomeado estiver vazio
          if (normalized[fieldName] === "" && entityConfig[key]) {
            normalized[fieldName] = entityConfig[key];
          }
        }
      });
    }
    
    return normalized;
  } catch (error) {
    console.error("Erro ao normalizar entidade:", error, entityConfig);
    return {
      entity: entityConfig.entity || "",
      name: entityConfig.name || "",
      image: entityConfig.image || "",
      image_rotated: entityConfig.image_rotated || "",
      velocidade: entityConfig.velocidade || "",
      altitude: entityConfig.altitude || "",
      condition: entityConfig.condition || "",
      ...entityConfig
    };
  }
}

function normalizeEntitiesConfig(entities) {
  if (!Array.isArray(entities)) {
    return [];
  }
  return entities
    .filter((entityConfig) => entityConfig && typeof entityConfig === "object")
    .map((entityConfig) => {
      try {
        return normalizeEntityConfig(entityConfig);
      } catch (error) {
        console.error("Erro ao normalizar entidade:", error, entityConfig);
        return entityConfig;
      }
    });
}

class GoogleMapsCarCardCadu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._styleElement = document.createElement("style");
    this.shadowRoot.appendChild(this._styleElement);
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "map-controls";
    this.shadowRoot.appendChild(this.controlsContainer);
    this.mapContainer = document.createElement("div");
    this.mapContainer.id = "map";
    this.shadowRoot.appendChild(this.mapContainer);
    this.markers = {}; // Armazena marcadores por entidade
    this.infoBoxes = {}; // Armazena InfoBoxes por entidade
    this.lastPositions = {}; // Armazena a ultima posicao de cada entidade
    this._uiState = {
      trafficEnabled: false,
      nightModeEnabled: false,
      followEnabled: false,
      trafficOverride: false,
      nightModeOverride: false,
      followOverride: false,
      rotateImageEnabled: false,
      arrowEnabled: true,
      entityVisibility: {},
    };
    this._updateStyles();
  }

  _updateStyles() {
    const maxHeight = this._config?.max_height || null;
    const maxWidth = this._config?.max_width || null;
    
    // Altura padrão: 450px mobile, 600px desktop
    const defaultHeightMobile = "450px";
    const defaultHeightDesktop = "600px";
    
    const heightMobile = maxHeight ? `${maxHeight}px` : defaultHeightMobile;
    const heightDesktop = maxHeight ? `${maxHeight}px` : defaultHeightDesktop;
    
    const widthStyle = maxWidth ? `max-width: ${maxWidth}px;` : "";
    
    const showTopControls = this._config?.mostrar_menu !== false;
    const hideMapCredits = this._config?.ocultar_creditos === true;

    this._styleElement.textContent = `
      :host {
        display: block;
        position: relative;
        ${widthStyle}
      }
      #map {
        width: 100%;
        height: ${heightMobile};
        border-radius: 0 0 6px 6px;
        overflow: hidden;
      }

      @media (min-width: 768px) {
        #map {
          height: ${heightDesktop};
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
        /* Permitir cliques na info box se necessario */
        pointer-events: none; 
      }
      .info-box .arrow-box {
        font-size: 15px;
      }
      .info-box .velocidade {
        font-size: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 24px;
      }
      .info-box .altitude {
        font-size: 12px;
      }
      .map-controls {
        display: flex;
        ${showTopControls ? "" : "display: none;"}
        flex-wrap: wrap;
        gap: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px 6px 0 0;
        font-size: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        margin-bottom: 0;
      }
      .map-controls label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .map-controls .entity-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      @media (max-width: 768px) {
        .map-controls {
          flex-direction: column;
          gap: 6px;
          padding: 6px 8px;
        }
      }
      ${hideMapCredits ? `
      /* Oculta barra inferior/termos/creditos do Google Maps */
      .gm-style-cc,
      .gmnoprint,
      .gm-style a[href^="https://maps.google.com/maps"],
      .gm-style a[href^="https://www.google.com/intl/"],
      .gm-style .gm-style-cc {
        display: none !important;
      }` : ""}
    `;
  }

  _getStorageKey() {
    // Gera uma chave única baseada na configuração do card
    // Usa as entidades para criar uma chave única por instância do card
    if (!this._config || !this._config.entities) {
      return "google-maps-car-card-cadu-default";
    }
    const entityIds = this._config.entities
      .map((e) => e.entity)
      .sort()
      .join(",");
    return `google-maps-car-card-cadu-${entityIds}`;
  }

  _loadUIState() {
    try {
      const storageKey = this._getStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          this._uiState = {
            trafficEnabled: parsed.trafficEnabled === true,
            nightModeEnabled: parsed.nightModeEnabled === true,
            followEnabled: parsed.followEnabled === true,
            trafficOverride: parsed.trafficOverride === true,
            nightModeOverride: parsed.nightModeOverride === true,
            followOverride: parsed.followOverride === true,
            rotateImageEnabled: parsed.rotateImageEnabled === true,
            arrowEnabled: parsed.arrowEnabled !== false, // Padrão true
            entityVisibility: parsed.entityVisibility || {},
          };
        }
      }
    } catch (error) {
      console.error("Erro ao carregar estado do UI do localStorage:", error);
    }
  }

  _saveUIState() {
    try {
      const storageKey = this._getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(this._uiState));
    } catch (error) {
      console.error("Erro ao salvar estado do UI no localStorage:", error);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._map && this._config) {
      this._updateMap();
      this._applyMapTypeOptions();
      this._applyNightMode();
      this._toggleTrafficLayer();
    }
  }

  setConfig(config) {
    try {
      // Normalizar configuração ao receber ANTES de armazenar
      const normalized = this._normalizeConfig(config || {});
      this._config = normalized;
      
      if (!this._config.entities || !this._config.api_key) {
        // Permitir configuração incompleta durante edição, mas logar aviso
        console.warn("Configuracao incompleta: api_key ou entities ausentes");
      }
      
      this._config = {
        ...this._config,
        transito: typeof this._config.transito === "string" ? this._config.transito : null,
        modo_noturno: typeof this._config.modo_noturno === "string" ? this._config.modo_noturno : null,
        follow_entity:
          typeof this._config.follow_entity === "string" ? this._config.follow_entity : null,
        rotate_image: this._config.rotate_image === true,
        mostrar_menu: this._config.mostrar_menu !== false,
        mostrar_tipo_mapa: this._config.mostrar_tipo_mapa !== false,
        tipo_mapa: typeof this._config.tipo_mapa === "string" ? this._config.tipo_mapa : "roadmap",
        mostrar_tela_cheia: this._config.mostrar_tela_cheia !== false,
        mostrar_controles_navegacao: this._config.mostrar_controles_navegacao !== false,
        ocultar_creditos: this._config.ocultar_creditos === true,
        transito_on: this._config.transito_on === true,
        modo_noturno_on: this._config.modo_noturno_on === true,
        seguir_on: this._config.seguir_on === true,
      };
      
      // Carregar estado salvo do localStorage antes de inicializar valores padrão
      this._loadUIState();
      
      // Inicializar valores padrão apenas se não existirem no estado carregado
      if (this._uiState.trafficEnabled === undefined) {
        this._uiState.trafficEnabled = false;
      }
      if (this._uiState.nightModeEnabled === undefined) {
        this._uiState.nightModeEnabled = false;
      }
      if (this._uiState.followEnabled === undefined) {
        this._uiState.followEnabled = false;
      }
      if (this._uiState.trafficOverride === undefined) {
        this._uiState.trafficOverride = false;
      }
      if (this._uiState.nightModeOverride === undefined) {
        this._uiState.nightModeOverride = false;
      }
      if (this._uiState.followOverride === undefined) {
        this._uiState.followOverride = false;
      }
      if (this._uiState.rotateImageEnabled === undefined) {
        this._uiState.rotateImageEnabled = false;
      }
      if (this._uiState.arrowEnabled === undefined) {
        this._uiState.arrowEnabled = true;
      }

      // Se o menu estiver oculto e não houver entidade, permite configurar via YAML
      if (this._config.mostrar_menu === false) {
        if (!this._config.transito) {
          this._uiState.trafficEnabled = this._config.transito_on === true;
        }
        if (!this._config.modo_noturno) {
          this._uiState.nightModeEnabled = this._config.modo_noturno_on === true;
        }
        if (!this._config.follow_entity) {
          this._uiState.followEnabled = this._config.seguir_on === true;
        }
      }
      this._initializeEntityVisibility();
      
      // Atualizar estilos com novos valores de altura/largura
      this._updateStyles();
      
      // Se o mapa já existe, atualizar os controles com os valores carregados
      if (this._map && this.controlsContainer) {
        this._renderControls();
        // Aplicar modo noturno e trânsito após renderizar controles para garantir que o estado está correto
        // Usar requestAnimationFrame para garantir que o DOM está atualizado
        requestAnimationFrame(() => {
          this._applyNightMode();
          this._toggleTrafficLayer();
          this._applyMapTypeOptions();
          this._applyMapControlsOptions();
        });
      }
      
      if (!this._config.api_key) {
        this.mapContainer.innerHTML = '<div style="padding: 20px; color: white;">Configure a API Key do Google Maps</div>';
        return;
      }
      
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
    } catch (error) {
      console.error("Erro ao definir configuração no card:", error);
    }
  }
  
  _normalizeConfig(config) {
    // Mesma lógica de normalização usada no editor
    if (!config || typeof config !== "object") {
      return { 
        api_key: "",
        follow_entity: "",
        entities: []
      };
    }
    try {
      const normalizedEntities = normalizeEntitiesConfig(config.entities || []);
      const normalized = {
        ...config,
        entities: normalizedEntities,
      };
      return normalized;
    } catch (error) {
      return config;
    }
  }

  _applyMapTypeOptions() {
    if (!this._map) return;
    this._map.setOptions({
      mapTypeId: this._config.tipo_mapa || "roadmap",
      mapTypeControl: this._config.mostrar_tipo_mapa !== false,
    });
  }

  _applyMapControlsOptions() {
    if (!this._map) return;
    this._map.setOptions({
      fullscreenControl: this._config.mostrar_tela_cheia !== false,
      zoomControl: this._config.mostrar_controles_navegacao !== false,
    });
  }

  getCardSize() {
    return 6;
  }

  _initializeMap() {
    if (!this.mapContainer) return;
    
    this._map = new google.maps.Map(this.mapContainer, {
      center: { lat: -30.0277, lng: -51.2287 }, // Exemplo inicial, sera ajustado
      zoom: 17, // Zoom inicial
      streetViewControl: false, // Desabilita o controle de Street View
      mapTypeControl: this._config.mostrar_tipo_mapa !== false,
      mapTypeId: this._config.tipo_mapa || "roadmap",
      fullscreenControl: this._config.mostrar_tela_cheia !== false,
      zoomControl: this._config.mostrar_controles_navegacao !== false,
    });
    this._renderControls();
    // Aplicar modo noturno após renderizar controles para garantir que o estado está carregado
    setTimeout(() => {
      this._applyNightMode();
    }, 50);

    if (this._config.entities) {
      this._config.entities.forEach((entityConfig) => {
        this._addOrUpdateMarker(entityConfig);
      });
    }

    if (this._shouldFollow()) {
      this._fitMapBounds();
    }

    this.trafficLayer = new google.maps.TrafficLayer(); // Define a camada de transito
    this._toggleTrafficLayer();
  }

  _updateMap() {
    if (!this._config.entities) return;
    
    this._config.entities.forEach((entityConfig) => {
      this._addOrUpdateMarker(entityConfig);
    });

    if (this._shouldFollow()) {
      this._fitMapBounds();
    }
  }

  _shouldFollow() {
    if (this._config.follow_entity && this._config.follow_entity !== "") {
      const followEntity = this._hass.states[this._config.follow_entity];
      if (!this._uiState.followOverride) {
        return followEntity && followEntity.state === "on";
      }
    }
    if (this._config.mostrar_menu === false && !this._config.follow_entity) {
      return this._config.seguir_on === true;
    }
    return this._uiState.followEnabled;
  }

  _applyNightMode() {
    if (!this._map) return;
    
    // Aguardar um pouco se o hass ainda não estiver disponível
    if (!this._hass && this._config.modo_noturno && typeof this._config.modo_noturno === "string" && this._config.modo_noturno !== "") {
      setTimeout(() => this._applyNightMode(), 100);
      return;
    }
    
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
    let nightMode = this._uiState.nightModeEnabled;
    if (
      typeof configNightMode === "string" &&
      configNightMode !== "" &&
      !this._uiState.nightModeOverride
    ) {
      nightMode = this._hass.states[configNightMode]?.state === "on";
    } else if (
      !configNightMode &&
      this._config.mostrar_menu === false &&
      this._config.modo_noturno_on === true
    ) {
      nightMode = true;
    }
    this._map.setOptions({
      styles: nightMode ? nightModeStyle : [],
    });
  }

  _toggleTrafficLayer() {
    if (!this.trafficLayer) return;
    
    const configTraffic = this._config.transito;
    let trafficEnabled = this._uiState.trafficEnabled;
    if (
      typeof configTraffic === "string" &&
      configTraffic !== "" &&
      !this._uiState.trafficOverride
    ) {
      trafficEnabled = this._hass.states[configTraffic]?.state === "on";
    } else if (
      !configTraffic &&
      this._config.mostrar_menu === false &&
      this._config.transito_on === true
    ) {
      trafficEnabled = true;
    }
    if (trafficEnabled) {
      this.trafficLayer.setMap(this._map);
    } else {
      this.trafficLayer.setMap(null);
    }
  }

  _addOrUpdateMarker(entityConfig) {
    if (!this._hass || !this._hass.states) return;
    
    const entity = this._hass.states[entityConfig.entity];
    const condition = entityConfig.condition
      ? this._hass.states[entityConfig.condition]
      : null;
    const conditionMet = entityConfig.condition
      ? condition && condition.state === "on"
      : this._uiState.entityVisibility[entityConfig.entity] !== false;
      
    if (entity && entity.state !== "unavailable" && conditionMet) {
      if (!entity.attributes.latitude || !entity.attributes.longitude) return;
      
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

      if (lastPosition) {
        deltaX = location.lng() - lastPosition.lng;
        deltaY = location.lat() - lastPosition.lat;
        
        // Se houver deslocamento significativo no GPS, recalcula a rotacao (prioridade ao movimento real)
        if (Math.abs(deltaX) > 0.00001 || Math.abs(deltaY) > 0.00001) {
          rotation = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        } else {
          // Se nao houve deslocamento significativo, mantem a ultima rotacao valida
          // Isso serve para sinaleiras (carro parado mantem a direcao)
          rotation = lastPosition.rotation !== 999 ? lastPosition.rotation : 999;
        }
      } else {
        rotation = 999; // Valor inicial para rotacao
      }

      const arrow = this._getArrowFromRotation(rotation);
      // Se rotation for 999 (parado), mantemos a ultima rotacao valida no lastPositions para nao perder referencia se precisar?
      // Nao, se rotation é 999, significa que queremos exibir "sem rotação".
      
      this.lastPositions[entityConfig.entity] = {
        lat: location.lat(),
        lng: location.lng(),
        rotation: rotation,
      };

      const markerTitle = this._getEntityDisplayName(entityConfig, entity);
      const shouldRotate = this._uiState.rotateImageEnabled === true;

      // Handle Marker Types Swapping
      if (shouldRotate) {
        if (marker && marker instanceof google.maps.Marker) {
          marker.setMap(null);
          marker = null;
        }
      } else {
        // Check if marker is OverlayView (custom)
        if (marker && typeof marker.draw === "function" && !(marker instanceof google.maps.Marker)) {
          marker.setMap(null);
          marker = null;
        }
      }

      if (shouldRotate) {
        // --- Standard Marker Implementation (rotated via icon) ---
        let cssRotation = 0;
        if (rotation !== 999) {
          cssRotation = 180 - rotation; // Assumindo imagem virada para a esquerda
        } else {
          cssRotation = 0; // Sem rotacao
        }

        const imageToUse = entityConfig.image_rotated || entityConfig.image || entity.attributes.entity_picture || "";

        if (!marker) {
          // Criar elemento HTML para o icone rotacionado
          const iconUrl = imageToUse;
          const iconElement = document.createElement("img");
          iconElement.src = iconUrl;
          iconElement.style.width = "60px";
          iconElement.style.height = "60px";
          iconElement.style.transform = `rotate(${cssRotation}deg)`;
          
          // Usar OverlayView para permitir rotacao CSS, mas mantendo a logica mais simples
          // Infelizmente google.maps.Marker nao suporta rotacao de imagem diretamente, so de SVG path
          // Entao precisamos usar OverlayView para rotacionar imagem PNG/JPG
          // Mas o usuario pediu para "ficar o mesmo de quando n ta rotacionando" (tamanho e tal)
          
          marker = new google.maps.OverlayView();
          marker.position = location;
          marker.rotation = cssRotation;
          marker.imageUrl = iconUrl;
          
          marker.onAdd = function() {
            const div = document.createElement("div");
            div.style.position = "absolute";
            // Tamanho original do icone (60x60)
            div.style.width = "60px";
            div.style.height = "60px";
            div.style.cursor = "pointer"; // Adicionar cursor pointer se quiser comportamento de clique
            
            // Imagem centralizada
            const img = document.createElement("img");
            img.src = this.imageUrl;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.position = "absolute";
            img.style.top = "0";
            img.style.left = "0";
            
            div.appendChild(img);
            this.div_ = div;
            this.img_ = img;
            
            const panes = this.getPanes();
            panes.overlayLayer.appendChild(div);
          };

          marker.draw = function() {
            const overlayProjection = this.getProjection();
            if (!overlayProjection || !this.position) return;
            const pos = overlayProjection.fromLatLngToDivPixel(this.position);
            const div = this.div_;
            if (div) {
              // Centralizar o container 60x60 no ponto (30, 30 de offset)
              div.style.left = (pos.x - 30) + "px";
              div.style.top = (pos.y - 30) + "px";
              
              // Rotacionar apenas a imagem interna ou o container?
              // Se rotacionar o container, tudo gira.
              div.style.transform = `rotate(${this.rotation}deg)`;
            }
          };

          marker.onRemove = function() {
            if (this.div_) {
              this.div_.parentNode.removeChild(this.div_);
              this.div_ = null;
            }
          };
          
          marker.getPosition = function() {
            return this.position;
          };

          marker.setMap(this._map);
          this.markers[entityConfig.entity] = marker;
        } else {
          marker.position = location;
          marker.rotation = cssRotation;
          
          // Update image if changed
          const newUrl = imageToUse;
          if (marker.imageUrl !== newUrl) {
            marker.imageUrl = newUrl;
            if (marker.img_) {
              marker.img_.src = newUrl;
            }
          }
          
          marker.draw();
        }
      } else {
        // --- Standard Marker Implementation ---
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
        const arrowHtml = this._parent._uiState.arrowEnabled 
          ? `<div class="arrow-box">${arrow} <!-- seta --></div>` 
          : "";
        
        div.innerHTML = `
          ${arrowHtml}
          ${infoBoxText}
        `;
        // <br> ${rotation} - ${deltaX} - ${deltaY}
        this.div_ = div;
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(div);
      };
      // Bind this context to access _uiState inside onAdd
      infoBox._parent = this;
      infoBox.draw = function () {
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(location);
        const div = this.div_;
        
        let xOffset = 0;
        let yOffset = -50; // Padrão quando não há rotação
        if (shouldRotate) {
          yOffset = -65;
        }
        
        // Se rotação ativada, calcular posição relativa ao "teto" do carro
        if (shouldRotate && rotation !== 999) {
             let cssRotation = 180 - rotation; // O mesmo calculo usado para a imagem
             const radius = 65; // Distancia do centro aumentada para afastar do carro (antes 40)
             const radiusy = radius;
             
             // Converter para radianos
             const rad = cssRotation * (Math.PI / 180);
             
             // Calcular offsets baseados na rotação do CSS
             // 0 graus (Original/Esquerda) -> x=0, y=-R (Cima)
             // 180 graus (Direita) -> x=0, y=R (Baixo)
             xOffset = radius * Math.sin(rad);
             yOffset = -radiusy * Math.cos(rad);
        }

        div.style.left = `${position.x + xOffset}px`;
        div.style.top = `${position.y + yOffset}px`;
        
        // Centralizar a div no ponto calculado
        div.style.transform = "translate(-50%, -50%)";
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
        this._centerOnMarkerWithPadding(location);
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
    if (!this.controlsContainer) return;
    this.controlsContainer.innerHTML = "";

    if (this._config.mostrar_menu === false) {
      return;
    }

    const trafficLabel = document.createElement("label");
    const trafficCheckbox = document.createElement("input");
    trafficCheckbox.type = "checkbox";
    if (
      typeof this._config.transito === "string" &&
      this._config.transito !== "" &&
      !this._uiState.trafficOverride
    ) {
      trafficCheckbox.checked = this._hass?.states?.[this._config.transito]?.state === "on";
    } else {
      trafficCheckbox.checked = this._uiState.trafficEnabled;
    }
    trafficCheckbox.addEventListener("change", () => {
      this._uiState.trafficOverride = true;
      this._uiState.trafficEnabled = trafficCheckbox.checked;
      this._saveUIState();
      this._toggleTrafficLayer();
    });
    trafficLabel.appendChild(trafficCheckbox);
    trafficLabel.appendChild(document.createTextNode("Transito"));
    this.controlsContainer.appendChild(trafficLabel);

    const nightLabel = document.createElement("label");
    const nightCheckbox = document.createElement("input");
    nightCheckbox.type = "checkbox";
    if (
      typeof this._config.modo_noturno === "string" &&
      this._config.modo_noturno !== "" &&
      !this._uiState.nightModeOverride
    ) {
      nightCheckbox.checked = this._hass?.states?.[this._config.modo_noturno]?.state === "on";
    } else {
      nightCheckbox.checked = this._uiState.nightModeEnabled;
    }
    nightCheckbox.addEventListener("change", () => {
      this._uiState.nightModeOverride = true;
      this._uiState.nightModeEnabled = nightCheckbox.checked;
      this._saveUIState();
      this._applyNightMode();
    });
    nightLabel.appendChild(nightCheckbox);
    nightLabel.appendChild(document.createTextNode("Modo noturno"));
    this.controlsContainer.appendChild(nightLabel);

    const followLabel = document.createElement("label");
    const followCheckbox = document.createElement("input");
    followCheckbox.type = "checkbox";
    if (
      typeof this._config.follow_entity === "string" &&
      this._config.follow_entity !== "" &&
      !this._uiState.followOverride
    ) {
      followCheckbox.checked =
        this._hass?.states?.[this._config.follow_entity]?.state === "on";
    } else {
      followCheckbox.checked = this._uiState.followEnabled;
    }
    followCheckbox.addEventListener("change", () => {
      this._uiState.followOverride = true;
      this._uiState.followEnabled = followCheckbox.checked;
      this._saveUIState();
      if (this._shouldFollow()) {
        this._fitMapBounds();
      }
    });
    followLabel.appendChild(followCheckbox);
    followLabel.appendChild(document.createTextNode("Seguir"));
    this.controlsContainer.appendChild(followLabel);

    const rotateLabel = document.createElement("label");
    const rotateCheckbox = document.createElement("input");
    rotateCheckbox.type = "checkbox";
    rotateCheckbox.checked = this._uiState.rotateImageEnabled;
    rotateCheckbox.addEventListener("change", () => {
      this._uiState.rotateImageEnabled = rotateCheckbox.checked;
      this._saveUIState();
      // Recarrega os marcadores para aplicar/remover rotação
      if (this._config.entities) {
        this._config.entities.forEach((entityConfig) => {
          this._addOrUpdateMarker(entityConfig);
        });
      }
    });
    rotateLabel.appendChild(rotateCheckbox);
    rotateLabel.appendChild(document.createTextNode("Rotação"));
    this.controlsContainer.appendChild(rotateLabel);

    const arrowCheckbox = document.createElement("input");
    arrowCheckbox.type = "checkbox";
    arrowCheckbox.checked = this._uiState.arrowEnabled;
    arrowCheckbox.addEventListener("change", () => {
      this._uiState.arrowEnabled = arrowCheckbox.checked;
      this._saveUIState();
      if (this._config.entities) {
        this._config.entities.forEach((entityConfig) => {
          this._addOrUpdateMarker(entityConfig);
        });
      }
    });
    const arrowLabel = document.createElement("label");
    arrowLabel.appendChild(arrowCheckbox);
    arrowLabel.appendChild(document.createTextNode("Seta"));
    this.controlsContainer.appendChild(arrowLabel);

    if (this._config.entities) {
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
          this._saveUIState();
          this._addOrUpdateMarker(entityConfig);
        });
        entityToggle.appendChild(entityCheckbox);
        entityToggle.appendChild(document.createTextNode(entityLabel));
        this.controlsContainer.appendChild(entityToggle);
      });
    }
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

    if (entityConfig.velocidade && this._hass && this._hass.states[entityConfig.velocidade]) {
      const speed = parseFloat(this._hass.states[entityConfig.velocidade].state).toFixed(0);
      infoBoxText += `<div class="velocidade"> ${speed} km/h</div>`;
    }
    if (entityConfig.altitude && this._hass && this._hass.states[entityConfig.altitude]) {
      const altitude = parseFloat(this._hass.states[entityConfig.altitude].state).toFixed(0);
      infoBoxText += `<div class="altitude"> &#9650; ${altitude} m</div>`;
    }

    return infoBoxText;
  }

  _fitMapBounds() {
    if (!this._map || !this.markers || Object.keys(this.markers).length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    Object.values(this.markers).forEach((marker) => {
      bounds.extend(marker.getPosition());
    });

    // Se seguir está ativado, usar padding para mostrar as info boxes
    const padding = this._shouldFollow() ? { top: 100, right: 50, bottom: 50, left: 50 } : 0;
    
    this._map.fitBounds(bounds, padding);

    // Listener para apos ajuste dos limites
    google.maps.event.addListenerOnce(this._map, "bounds_changed", () => {
      const maxZoom = 18; // Define o zoom maximo que voce deseja permitir
      if (this._map.getZoom() > maxZoom) {
        this._map.setZoom(maxZoom);
      }
    });
  }

  _centerOnMarkerWithPadding(location) {
    if (!this._map) return;
    
    // Criar bounds com padding para mostrar as info boxes acima do marcador
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(location);
    
    // Estender um pouco para cima (norte) para dar espaço para as info boxes
    const paddingLat = 0.002; // Aproximadamente 200 metros
    const paddingLng = 0.001; // Aproximadamente 100 metros
    
    bounds.extend(new google.maps.LatLng(location.lat() + paddingLat, location.lng()));
    bounds.extend(new google.maps.LatLng(location.lat() - paddingLat * 0.3, location.lng()));
    bounds.extend(new google.maps.LatLng(location.lat(), location.lng() + paddingLng));
    bounds.extend(new google.maps.LatLng(location.lat(), location.lng() - paddingLng));
    
    // Usar fitBounds com padding para garantir espaço para as info boxes
    this._map.fitBounds(bounds, { top: 100, right: 50, bottom: 50, left: 50 });
    
    // Limitar zoom máximo
    google.maps.event.addListenerOnce(this._map, "bounds_changed", () => {
      const maxZoom = 18;
      if (this._map.getZoom() > maxZoom) {
        this._map.setZoom(maxZoom);
      }
    });
  }
}

class GoogleMapsCarCardCaduEditor extends HTMLElement {
  constructor() {
    super();
    this._updating = false;
  }

  setConfig(config) {
    try {
      // Normalizar configuração ao receber ANTES de armazenar
      const normalized = this._normalizeConfig(config || {});
      this._config = normalized;
      
      // Se já está renderizado e hass está disponível, atualizar o form
      if (this._rendered && this._hass) {
        this._syncFormData();
      } else if (!this._rendered && this._hass) {
        // Se não está renderizado mas hass está disponível, renderizar
        this._render();
      }
      // Se hass ainda não está disponível, aguardar que seja setado
    } catch (error) {
      console.error("Erro ao definir configuração:", error, config);
      this._config = config || {};
      if (this._rendered && this._hass) {
        this._syncFormData();
      }
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._hass) {
      return;
    }
    
    if (this._rendered && !this._updating) {
      this._syncFormData();
    } else if (!this._rendered && this._config) {
      this._render();
    }
  }

  _render() {
    if (!this._hass) {
      return; // Não renderizar se hass não estiver disponível
    }
    
    this._rendered = true;
    this.innerHTML = "";
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    
    // Garantir que os dados estão normalizados antes de passar para o form
    const normalizedConfig = this._normalizeConfig(this._config || {});
    
    // Criar uma cópia profunda para evitar problemas de referência
    let formData;
    try {
      formData = JSON.parse(JSON.stringify(normalizedConfig));
    } catch (error) {
      console.error("Erro ao criar cópia dos dados:", error);
      formData = { ...normalizedConfig };
    }
    
    // Garantir que todos os campos esperados existam
    formData.api_key = formData.api_key || "";
    formData.follow_entity = formData.follow_entity || "";
    formData.modo_noturno = formData.modo_noturno || "";
    formData.transito = formData.transito || "";
    formData.mostrar_menu = formData.mostrar_menu !== false;
    formData.mostrar_tipo_mapa = formData.mostrar_tipo_mapa !== false;
    formData.tipo_mapa = formData.tipo_mapa || "roadmap";
    formData.mostrar_tela_cheia = formData.mostrar_tela_cheia !== false;
    formData.mostrar_controles_navegacao = formData.mostrar_controles_navegacao !== false;
    formData.ocultar_creditos = formData.ocultar_creditos === true;
    formData.transito_on = formData.transito_on === true;
    formData.modo_noturno_on = formData.modo_noturno_on === true;
    formData.seguir_on = formData.seguir_on === true;
    formData.max_height = formData.max_height || null;
    formData.max_width = formData.max_width || null;
    formData.entities = formData.entities || [];
    
    form.schema = this._buildSchema();
    form.computeLabel = (schema) => schema.label || schema.name;
    
    // Definir os dados após definir o schema
    form.data = formData;
    
    form.addEventListener("value-changed", (event) => {
      if (!this._updating) {
        try {
          this._updating = true;
          this._dispatchConfigChanged(event.detail.value);
        } catch (error) {
          console.error("Erro ao processar mudança de valor:", error);
        } finally {
          // Usar setTimeout para garantir que o evento seja processado antes de resetar
          setTimeout(() => {
            this._updating = false;
          }, 100);
        }
      }
    });
    
    this.appendChild(form);
    this._form = form;
    
    // Aguardar um frame para garantir que o form está totalmente renderizado
    requestAnimationFrame(() => {
      if (this._form && this._form.data !== formData) {
        this._form.data = formData;
      }
    });
  }

  _syncFormData() {
    if (this._form && !this._updating && this._hass) {
      try {
        this._updating = true;
        this._form.hass = this._hass;
        // Normalizar configuração antes de sincronizar com o form
        const normalizedConfig = this._normalizeConfig(this._config || {});
        // Criar uma cópia profunda para evitar problemas de referência
        let formData;
        try {
          formData = JSON.parse(JSON.stringify(normalizedConfig));
        } catch (error) {
          formData = { ...normalizedConfig };
        }
        this._form.data = formData;
      } catch (error) {
        console.error("Erro ao sincronizar dados do form:", error, this._config);
      } finally {
        setTimeout(() => {
          this._updating = false;
        }, 50);
      }
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
        name: "transito_on",
        label: "Transito ligado (sem entidade)",
        selector: { boolean: {} },
      },
      {
        name: "mostrar_menu",
        label: "Mostrar menu superior (opcional)",
        selector: { boolean: {} },
      },
      {
        name: "mostrar_tipo_mapa",
        label: "Mostrar botões Mapa/Satélite (opcional)",
        selector: { boolean: {} },
      },
      {
        name: "mostrar_tela_cheia",
        label: "Mostrar botão tela cheia (opcional)",
        selector: { boolean: {} },
      },
      {
        name: "mostrar_controles_navegacao",
        label: "Mostrar controles de navegação (opcional)",
        selector: { boolean: {} },
      },
      {
        name: "ocultar_creditos",
        label: "Ocultar créditos/termos do mapa (opcional)",
        selector: { boolean: {} },
      },
      {
        name: "modo_noturno_on",
        label: "Modo noturno ligado (sem entidade)",
        selector: { boolean: {} },
      },
      {
        name: "seguir_on",
        label: "Seguir ligado (sem entidade)",
        selector: { boolean: {} },
      },
      {
        name: "tipo_mapa",
        label: "Tipo de mapa (opcional)",
        selector: {
          select: {
            options: [
              { label: "Mapa", value: "roadmap" },
              { label: "Satélite", value: "satellite" },
              { label: "Híbrido", value: "hybrid" },
              { label: "Terreno", value: "terrain" },
            ],
          },
        },
      },
      {
        name: "max_height",
        label: "Altura máxima do mapa em pixels (opcional)",
        selector: { number: { min: 100, max: 2000, step: 10, unit_of_measurement: "px" } },
      },
      {
        name: "max_width",
        label: "Largura máxima do mapa em pixels (opcional)",
        selector: { number: { min: 100, max: 2000, step: 10, unit_of_measurement: "px" } },
      },
      {
        name: "entities",
        label: "Entidades",
        selector: {
          object: {
            multiple: true,
            label_field: "entity",
            fields: {
              entity: {
                label: "Entidade",
                required: true,
                selector: { entity: {} },
              },
              name: {
                label: "Nome personalizado (opcional)",
                selector: { text: {} },
              },
              image: {
                label: "Imagem (opcional)",
                selector: { text: {} },
              },
              image_rotated: {
                label: "Imagem Rotacionada (opcional, beta)",
                selector: { text: {} },
              },
              velocidade: {
                label: "Sensor de velocidade (opcional)",
                selector: { entity: {} },
              },
              altitude: {
                label: "Sensor de altitude (opcional)",
                selector: { entity: {} },
              },
              condition: {
                label: "Condicao (opcional)",
                selector: { entity: { domain: "input_boolean" } },
              },
            },
          },
        },
      },
    ];
  }

  _normalizeConfig(config) {
    if (!config || typeof config !== "object") {
      return { 
        api_key: "",
        follow_entity: "",
        max_height: null,
        max_width: null,
        entities: []
      };
    }
    try {
      // Normalizar entidades
      const normalizedEntities = normalizeEntitiesConfig(config.entities || []);
      
      // Criar objeto normalizado preservando todos os campos
      const normalized = {
        api_key: config.api_key || "",
        follow_entity: config.follow_entity || "",
        modo_noturno: config.modo_noturno || "",
        transito: config.transito || "",
        mostrar_menu: config.mostrar_menu !== false,
        mostrar_tipo_mapa: config.mostrar_tipo_mapa !== false,
        tipo_mapa: config.tipo_mapa || "roadmap",
        mostrar_tela_cheia: config.mostrar_tela_cheia !== false,
        mostrar_controles_navegacao: config.mostrar_controles_navegacao !== false,
        ocultar_creditos: config.ocultar_creditos === true,
        transito_on: config.transito_on === true,
        modo_noturno_on: config.modo_noturno_on === true,
        seguir_on: config.seguir_on === true,
        max_height: config.max_height || null,
        max_width: config.max_width || null,
        entities: normalizedEntities,
      };
      
      // Preservar outros campos que possam existir
      Object.keys(config).forEach((key) => {
        if (!normalized.hasOwnProperty(key)) {
          normalized[key] = config[key];
        }
      });
      
      return normalized;
    } catch (error) {
      console.error("Erro ao normalizar configuração:", error, config);
      return {
        api_key: config.api_key || "",
        follow_entity: config.follow_entity || "",
        modo_noturno: config.modo_noturno || "",
        transito: config.transito || "",
        mostrar_menu: config.mostrar_menu !== false,
        mostrar_tipo_mapa: config.mostrar_tipo_mapa !== false,
        tipo_mapa: config.tipo_mapa || "roadmap",
        mostrar_tela_cheia: config.mostrar_tela_cheia !== false,
        mostrar_controles_navegacao: config.mostrar_controles_navegacao !== false,
        ocultar_creditos: config.ocultar_creditos === true,
        transito_on: config.transito_on === true,
        modo_noturno_on: config.modo_noturno_on === true,
        seguir_on: config.seguir_on === true,
        max_height: config.max_height || null,
        max_width: config.max_width || null,
        entities: Array.isArray(config.entities) ? config.entities : [],
      };
    }
  }

  _dispatchConfigChanged(config) {
    if (!config || typeof config !== "object") {
      return;
    }
    try {
      // Garantir que a configuração está normalizada antes de salvar
      const normalizedConfig = this._normalizeConfig(config);
      this._config = normalizedConfig;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: normalizedConfig },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Erro ao despachar mudança de configuração:", error);
      // Em caso de erro, ainda tenta salvar a configuração original
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
