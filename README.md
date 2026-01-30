# Google Maps Car Card Cadu

Cartao customizado do Home Assistant para exibir entidades no Google Maps com caixas de informacao, direcao e velocidade.

## Instalacao (HACS)

1. Adicione este repositorio como **Custom Repository** no HACS (categoria: Lovelace).
2. Instale o cartao.
3. Adicione o recurso no Lovelace em **Configuracao > Painel > Recursos**:

```
/url/google-maps-car-card-cadu.js
```

## Configuracao

```yaml
type: "custom:google-maps-car-card-cadu"
api_key: "SUA_GOOGLE_MAPS_API_KEY"
follow_entity: input_boolean.seguir_mapa
entities:
  - entity: person.meu_dispositivo
    image: /local/imagens/carro.png
    image_rotated: /local/imagens/carro_rot.png
    velocidade: sensor.velocidade_dispositivo
    altitude: sensor.altitude_dispositivo
```

Exemplo com varias entidades:

```yaml
type: "custom:google-maps-car-card-cadu"
api_key: "SUA_GOOGLE_MAPS_API_KEY"
follow_entity: ""
entities:
  - entity: device_tracker.song_plus_premium_cadu
    image: /local/song.png
    velocidade: sensor.electro_song_cadu_speed
    altitude: sensor.electro_song_cadu_location_altitude
  - entity: device_tracker.seal
    image: /local/seal.png
    velocidade: sensor.electro_seal_speed
    altitude: sensor.electro_seal_location_altitude
grid_options:
  columns: full
```

### Opcoes

- `api_key`: Chave da API do Google Maps.
- `follow_entity`: Entidade booleana que, quando ligada, ajusta/centraliza o mapa.
- `modo_noturno`: (Opcional) Entidade booleana para aplicar o estilo noturno. Se nao definido, o cartao mostra um toggle na interface.
- `transito`: (Opcional) Entidade booleana para mostrar a camada de transito. Se nao definido, o cartao mostra um toggle na interface.
- `transito_on`: (Opcional) Liga/desliga o transito quando nao usa entidade. Padrao: `false`.
- `modo_noturno_on`: (Opcional) Liga/desliga o modo noturno quando nao usa entidade. Padrao: `false`.
- `seguir_on`: (Opcional) Liga/desliga o seguir quando nao usa entidade. Padrao: `false`.
- `mostrar_menu`: (Opcional) Exibe/oculta o menu superior do cartao. Padrao: `true`.
- `mostrar_tipo_mapa`: (Opcional) Exibe/oculta os botoes Mapa/Satelite. Padrao: `true`.
- `mostrar_tela_cheia`: (Opcional) Exibe/oculta o botao de tela cheia. Padrao: `true`.
- `mostrar_controles_navegacao`: (Opcional) Exibe/oculta os controles de navegacao (zoom). Padrao: `true`.
- `ocultar_creditos`: (Opcional) Oculta a barra inferior de termos/creditos. Padrao: `false`.
- `tipo_mapa`: (Opcional) Tipo inicial do mapa. Valores: `roadmap`, `satellite`, `hybrid`, `terrain`. Padrao: `roadmap`.
- `entities`: Lista de entidades para exibir.
  - `entity`: Entidade com latitude/longitude.
  - `condition`: (Opcional) Entidade booleana que controla se o marcador aparece. Se nao definido, o cartao mostra um toggle na interface.
  - `image`: URL/arquivo local para o icone do marcador (opcional).
  - `image_rotated`: URL/arquivo local para o icone quando a rotacao estiver ativada (opcional).
  - `velocidade`: Sensor de velocidade para mostrar na caixa de info.
  - `altitude`: Sensor de altitude para mostrar na caixa de info.

### Controles na interface

- **Rotacao**: Ativa/desativa a rotacao do marcador.
- **Seta**: Exibe/oculta a seta de direcao na caixa de info (mantem velocidade/altitude).

## Desenvolvimento

O arquivo principal do cartao fica em `google-maps-car-card-cadu.js`.

## Solucao de problemas

- **`Google Maps JavaScript API error: BillingNotEnabledMapError`**: a chave da API existe, mas o faturamento nao esta habilitado no projeto do Google Cloud. Ative o faturamento e confirme se a API do Google Maps JavaScript esta habilitada no projeto. Sem isso o mapa mostra "For development purposes only" e nao carrega corretamente.
- **`Esta pagina nao carregou o Google Maps corretamente`**: normalmente aparece junto com o erro acima ou quando a chave nao tem permissoes. Verifique a chave, restricoes de dominio/IP e se a API correta esta ativa.
- **Erro 404 ao carregar recursos (`Failed to load resource: ... 404`)**: indica que um recurso externo ou de outro componente nao foi encontrado. Confirme se o caminho do recurso foi adicionado corretamente em **Configuracao > Painel > Recursos** e se o arquivo esta instalado.
