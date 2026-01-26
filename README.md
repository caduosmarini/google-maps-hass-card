# Google Maps Card Cadu1

Cartao customizado do Home Assistant para exibir entidades no Google Maps com caixas de informacao, direcao e velocidade.

## Instalacao (HACS)

1. Adicione este repositorio como **Custom Repository** no HACS (categoria: Lovelace).
2. Instale o cartao.
3. Adicione o recurso no Lovelace em **Configuracao > Painel > Recursos**:

```
/url/google-maps-card-cadu1.js
```

## Configuracao

```yaml
type: "custom:google-maps-card-cadu1"
api_key: "SUA_GOOGLE_MAPS_API_KEY"
follow_entity: input_boolean.seguir_mapa
entities:
  - entity: person.meu_dispositivo
    image: /local/imagens/carro.png
    velocidade: sensor.velocidade_dispositivo
    altitude: sensor.altitude_dispositivo
```

### Opcoes

- `api_key`: Chave da API do Google Maps.
- `follow_entity`: Entidade booleana que, quando ligada, ajusta/centraliza o mapa.
- `modo_noturno`: (Opcional) Entidade booleana para aplicar o estilo noturno. Se nao definido, o cartao mostra um toggle na interface.
- `transito`: (Opcional) Entidade booleana para mostrar a camada de transito. Se nao definido, o cartao mostra um toggle na interface.
- `entities`: Lista de entidades para exibir.
  - `entity`: Entidade com latitude/longitude.
  - `condition`: (Opcional) Entidade booleana que controla se o marcador aparece. Se nao definido, o cartao mostra um toggle na interface.
  - `image`: URL/arquivo local para o icone do marcador (opcional).
  - `velocidade`: Sensor de velocidade para mostrar na caixa de info.
  - `altitude`: Sensor de altitude para mostrar na caixa de info.

## Desenvolvimento

O arquivo principal do cartao fica em `google-maps-card-cadu1.js`.
