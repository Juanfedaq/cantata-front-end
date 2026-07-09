<script setup lang="ts">
// Política de Privacidade (pública). Conteúdo estático; o aviso de
// cookies (CookieConsent.vue) aponta para cá.
import AppLayout from '@/components/AppLayout.vue'
</script>

<template>
  <AppLayout>
    <article class="policy">
      <h1 class="page-title">Política de Privacidade</h1>
      <p class="updated">Última atualização: 8 de julho de 2026</p>

      <!-- Resumo emoldurado (bloco solto → moldura completa, guia §3) -->
      <div class="summary">
        <p>
          O Cantata coleta apenas o necessário para funcionar: seus dados de
          cadastro, o que você publica como artista e o histórico das suas
          compras. Pagamentos são processados pela Stripe — não guardamos
          dados de cartão. Não usamos rastreadores de publicidade e não
          vendemos dados a terceiros.
        </p>
      </div>

      <section>
        <h2>1. Quais dados coletamos</h2>
        <ul>
          <li><strong>Cadastro:</strong> nome, e-mail e senha (armazenada com hash — nunca em texto puro).</li>
          <li><strong>Perfil de artista:</strong> biografia e foto de perfil, quando você as envia.</li>
          <li><strong>Conteúdos publicados:</strong> arquivos, prévias, capas e metadados enviados para venda.</li>
          <li><strong>Compras:</strong> histórico de itens comprados e status de pagamento.</li>
          <li><strong>Pagamentos:</strong> processados pela Stripe. Os dados do seu cartão vão direto para ela — não passam pelos nossos servidores nem são armazenados por nós.</li>
        </ul>
      </section>

      <section>
        <h2>2. Para que usamos</h2>
        <ul>
          <li>Manter sua conta e sessão de acesso.</li>
          <li>Exibir seu perfil público de artista e seus conteúdos no catálogo.</li>
          <li>Processar compras, repasses a artistas e liberar seus downloads.</li>
          <li>Enviar e-mails transacionais (confirmação de cadastro, recuperação de senha).</li>
          <li>Moderar conteúdos enviados, conforme os termos da plataforma.</li>
        </ul>
        <p>Não enviamos marketing sem consentimento e não usamos seus dados para publicidade.</p>
      </section>

      <section>
        <h2>3. Cookies e armazenamento local</h2>
        <p>
          Usamos apenas armazenamento essencial, no <em>localStorage</em> do
          seu navegador — nada de cookies de rastreamento:
        </p>
        <table class="storage">
          <thead>
            <tr>
              <th>Chave</th>
              <th>Para quê</th>
              <th>Validade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sessão de login</td>
              <td>Manter você conectado entre visitas</td>
              <td>Até sair da conta</td>
            </tr>
            <tr>
              <td>Tema</td>
              <td>Lembrar sua escolha entre claro e escuro</td>
              <td>Permanente</td>
            </tr>
            <tr>
              <td>Consentimento</td>
              <td>Registrar que você viu o aviso de cookies</td>
              <td>Permanente</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li><strong>Stripe:</strong> processamento de pagamentos e repasses aos artistas (<a href="https://stripe.com/br/privacy" target="_blank" rel="noopener">política de privacidade da Stripe</a>).</li>
          <li><strong>Ninguém mais.</strong> Não vendemos nem alugamos dados pessoais a terceiros.</li>
        </ul>
      </section>

      <section>
        <h2>5. Seus direitos (LGPD)</h2>
        <p>
          Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018),
          você pode, a qualquer momento:
        </p>
        <ul>
          <li>Confirmar a existência de tratamento e acessar seus dados.</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
          <li>Solicitar a exclusão da sua conta e dos dados associados.</li>
          <li>Revogar consentimentos dados anteriormente.</li>
        </ul>
        <p>Para exercer qualquer um deles, fale com a equipe pelos canais oficiais do Cantata.</p>
      </section>

      <section>
        <h2>6. Segurança e retenção</h2>
        <p>
          Senhas são armazenadas com hash, o acesso é autenticado por token e
          os arquivos completos dos conteúdos ficam em área privada, liberados
          somente após a compra. Guardamos os dados apenas enquanto sua conta
          existir ou enquanto houver obrigação legal de retê-los (ex.:
          registros fiscais de vendas).
        </p>
      </section>

      <section>
        <h2>7. Mudanças nesta política</h2>
        <p>
          Se esta política mudar de forma relevante, avisaremos na plataforma
          e atualizaremos a data no topo desta página.
        </p>
      </section>
    </article>
  </AppLayout>
</template>

<style scoped lang="scss">
.policy {
  max-width: 760px;
  margin: 0 auto;
}

.page-title {
  font-family: $font-display;
  font-size: 1.8rem;
}

.updated {
  margin-top: 0.4rem;
  font-size: 0.85rem;
  color: $text-dim;
}

// Resumo destacado: moldura completa + fundo opaco (regra das vitrines —
// o backdrop de anéis não atravessa).
.summary {
  margin-top: 1.5rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid rgba($color-primary, 0.45);
  background: $fill-active-solid;
  line-height: 1.7;
  color: rgba(var(--fg-rgb), 0.85);
}

section {
  margin-top: 2.25rem;

  h2 {
    font-family: $font-display;
    font-size: 1.2rem;
    margin-bottom: 0.75rem;
  }

  p,
  li {
    line-height: 1.7;
    color: rgba(var(--fg-rgb), 0.7);
    font-size: 0.95rem;
  }

  p + p,
  ul + p {
    margin-top: 0.75rem;
  }

  ul {
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  strong {
    color: rgba(var(--fg-rgb), 0.9);
    font-weight: 600;
  }

  a {
    color: $gold-text;
    text-decoration: none;
    transition: color 0.5s $ease-brand;

    &:hover {
      color: $gold-strong;
      text-decoration: underline;
    }
  }
}

// Tabela blocada (guia §6): separadores de linha, headers uppercase.
.storage {
  width: 100%;
  margin-top: 1rem;
  border: 1px solid $line;
  border-collapse: collapse;
  font-size: 0.9rem;

  th {
    @include label-type;
    font-size: 0.7rem;
    text-align: left;
    color: $text-secondary;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid $line;
  }

  td {
    padding: 0.7rem 1rem;
    color: rgba(var(--fg-rgb), 0.75);
    border-bottom: 1px solid rgba(var(--fg-rgb), 0.08);
  }

  tr:last-child td {
    border-bottom: none;
  }
}
</style>
