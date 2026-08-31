# Koppert - Telemetria CSV to PDF & Gráficos Interativos

Aplicação web moderna, modular e responsiva para importação de arquivos CSV de telemetria/sensores, conversão e normalização automática de dados, geração de gráficos interativos de alta precisão com linha do tempo/zoom e exportação de relatórios corporativos customizáveis em PDF.

---

## 🌟 Principais Recursos

1. **Importação e Detecção Modular de Sensores**:
   - Arraste e solte ou selecione qualquer arquivo CSV.
   - Detecção automática de qualquer quantidade de colunas de sensores.
   - Suporte a múltiplos tipos de sensores com grandezas físicas padronizadas:
     - **Temperatura**: Unidade `°C`
     - **Umidade**: Unidade `%`
     - **Dióxido de Carbono (CO₂)**: Unidade `PPM`
     - **Pressão**: Unidade `Pa`
   - **Auto-Ajuste de Escala**: Normaliza automaticamente valores brutos (ex: `21700000` $\rightarrow$ `21,7 °C`, `71600000` $\rightarrow$ `71,6 %`, `350000000` $\rightarrow$ `350 PPM`).

2. **Gráfico Interativo de Alta Performance (Apache ECharts)**:
   - Navegação por linha do tempo com controle deslizante (*dataZoom brush / slider*) idêntico ao padrão industrial.
   - Seleção/deseleção modular de sensores em tempo real com botões de filtro rápido (*Apenas Temp, Apenas Umid, Apenas CO₂, Apenas Pressão*).
   - Cores exclusivas e contrastantes para cada sensor.
   - Tooltips ricos com valores e unidades correspondentes.

3. **Designer e Exportação de PDF Corporativo (jsPDF)**:
   - Personalização de cabeçalho com opção de upload de foto/logo da empresa.
   - Título, subtítulo, responsável técnico e parecer/observações editáveis.
   - Pré-visualização interativa da folha A4 com guias visuais de margens (superior, inferior, esquerda, direita).
   - Tabela de resumo estatístico no PDF (Mínimo, Máximo, Média e Última Leitura de cada sensor).
   - Download de PDF em alta resolução.

4. **Histórico em Nuvem com Firebase Firestore**:
   - Integração com Firebase (`koppertcvstopdf`).
   - Armazenamento automático e manual de gráficos gerados.
   - Painel de histórico para reabrir gráficos anteriores com 1 clique e cache local offline (*fallback*).

5. **Design Responsivo com Tema Claro e Escuro**:
   - Interface limpa inspirada na identidade visual da Koppert Biological Systems.

---

## 🚀 Como Executar Localmente ou Publicar

### Execução Local:
Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox, Safari) ou rodar um servidor local:

```bash
# Se tiver Python instalado:
python -m http.server 8080
```
Acesse `http://localhost:8080` no navegador.

### Publicação no GitHub Pages:
1. No seu repositório GitHub (`https://github.com/victorhugomota/CSV_TO_PDF_KOPPERT`), vá em **Settings** > **Pages**.
2. Em **Branch**, selecione `main` e a pasta `/ (root)`.
3. Clique em **Save**. O site estará disponível publicamente no link fornecido pelo GitHub.