# Rara Turismo

Prévia em Astro do site da Rara Turismo. A galeria acompanha a rolagem vertical em telas largas e aceita navegação lateral no celular. As fotos usadas são da Camila e foram obtidas nas versões WebP do site público atual.

O GitHub Pages publica uma prévia técnica para revisão do layout e da navegação. Esse build identifica a prévia no título da aba e desativa os atalhos de WhatsApp, telefone e Instagram. Os builds locais e do Cloudflare mantêm os links ativos.

## Rodar e compilar

```sh
npm ci
npm run dev
npm run build
npm run preview
```

O Astro gera o site em `dist/`. A prévia inclui a diretiva `noindex` em `src/pages/index.astro`. Na versão oficial, após a revisão, remova essa diretiva para permitir a indexação.

## Publicar no Cloudflare

Na conta da Rara Turismo, use um projeto Workers com arquivos estáticos. O comando de build é `npm run build` e a pasta de saída é `dist`. O arquivo `wrangler.jsonc` também permite publicar pelo Wrangler autenticado na conta da empresa. A prévia não requer segredos nem serviços de backend.
