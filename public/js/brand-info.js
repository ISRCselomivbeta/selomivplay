// ============================================================
// js/brand-info.js — PLAY MY v2.2.0
// Rodapé + Sobre + Como Funciona + Blockchain + FAQ Beta
// Foco: catálogo próprio do Selo MIV
// Rodapé aparece tanto logado quanto deslogado.
// Não depende de nenhum outro módulo.
// ============================================================

(function () {
  'use strict';

  // ============================================================
  // ⚙️ CONFIGURAÇÃO
  // ============================================================
  var BRAND = {
    razao_social: 'Selo MIV Produções',
    cnpj: '29.901.313/0001-00',
    endereco: 'São Paulo/SP — Brasil',
    email: 'selomivplay@gmail.com',
    email_suporte: 'selomiv@gmail.com',

    equipe: [
      { nome: 'Elzo Lima M.', cargo: 'Fundador', linkedin: 'https://www.linkedin.com/in/elzo-henschell-7a1474a7/' },
      { nome: 'S.M MGM',      cargo: 'Diretoria', linkedin: 'https://www.linkedin.com/in/selo-miv-958600419/' }
    ],

    blockchain: {
      nome: 'Rede Interna PLAY MY (desconectada do BTC Central)',
      descricao: 'Registramos cada investimento, royalty e trade em uma rede interna própria, auditável dentro do próprio PLAY MY. A rede é desconectada do BTC Central e foi criada para dar velocidade e transparência às operações internas.'
    },

    selo: {
      nome: 'SELO COIN',
      descricao: 'Moeda interna usada para comprar ingressos, desbloquear conteúdos exclusivos e participar de votações. Não é criptomoeda negociável em exchanges.'
    },

    catalogo: {
      nome: 'Selo MIV',
      descricao: 'Por enquanto, o PLAY MY negocia apenas músicas do catálogo próprio do Selo MIV. Isso garante curadoria, direitos autorais em ordem e transparência total sobre a origem de cada obra. Em breve, outros selos e artistas independentes poderão participar.'
    },

    redes: {
      instagram: 'https://www.instagram.com/selomivinc/',
      facebook:  'https://www.facebook.com/MIVRecord',
      youtube:   'https://www.youtube.com/@Selomiv'
    },

    redes_artista: {
      nome: 'Elzo Henschell',
      instagram: 'https://www.instagram.com/elzohenschell/',
      facebook:  'https://www.facebook.com/ElzoHenschell/',
      youtube:   'https://www.youtube.com/@ElzoHenschell'
    },

    versao: '2.2.0',
    versao_app: 'Beta 0.9',
    ano: new Date().getFullYear()
  };

  // ============================================================
  // FAQ — PERGUNTAS FREQUENTES (PLAY MY BETA / SELO MIV)
  // ============================================================
  var FAQ = [
    { q: 'O que é o PLAY MY?', a: 'PLAY MY é uma plataforma brasileira em versão beta que une streaming de música, investimento em artistas e royalties. O ouvinte pode ouvir de graça, e se quiser, investir em "ações" de músicas do catálogo do Selo MIV para receber uma parte dos ganhos futuros.' },
    { q: 'Quais músicas posso investir hoje?', a: 'Por enquanto, apenas músicas do catálogo próprio do Selo MIV. Isso garante curadoria, direitos autorais em ordem e transparência total sobre a origem de cada obra. Em breve, outros selos e artistas independentes poderão participar.' },
    { q: 'Por que só o catálogo do Selo MIV?', a: 'Porque estamos em beta. Preferimos começar com um catálogo controlado, com direitos autorais e contratos em ordem, do que abrir para qualquer música e correr risco jurídico. Quando o modelo estiver maduro, expandimos.' },
    { q: 'O PLAY MY é igual ao Spotify?', a: 'Não. O Spotify é focado só em ouvir música. O PLAY MY junta streaming + investimento. Você pode só ouvir, ou também investir em músicas do Selo MIV — como se fosse uma "bolsa de música".' },
    { q: 'Estou na versão beta. O que isso significa?', a: 'Significa que o PLAY MY ainda está em desenvolvimento. Algumas funções podem mudar, bugs podem aparecer e o catálogo ainda está crescendo. Estamos ouvindo feedback para melhorar antes do lançamento oficial.' },
    { q: 'Preciso pagar algo para usar?', a: 'Não. Ouvir música no PLAY MY é 100% grátis. Você só investe dinheiro se quiser comprar ações de músicas do Selo MIV. E mesmo assim, é você quem decide quanto.' },
    { q: 'Como funcionam os investimentos?', a: 'Cada música do Selo MIV tem um número limitado de "ações". Você compra ações com saldo (via PIX ou cartão) e passa a ter uma participação nos royalties futuros daquela música. Quanto mais a música toca, maior tende a ser o retorno — mas isso não é garantido.' },
    { q: 'O que é SELO COIN?', a: 'SELO COIN é a moeda interna do PLAY MY. Ela serve para comprar ingressos, desbloquear conteúdos exclusivos e participar de votações. Importante: SELO COIN NÃO é uma criptomoeda negociável em exchanges, é só dentro da plataforma.' },
    { q: 'Posso perder dinheiro investindo?', a: 'Sim. Como qualquer investimento, existe risco. Se a música não performar, você pode não recuperar o valor investido. Sempre invista apenas o que você pode perder. O PLAY MY não garante retorno.' },
    { q: 'O PLAY MY é uma instituição financeira?', a: 'Não. O PLAY MY é uma plataforma de tecnologia e música. Não somos banco, corretora ou instituição financeira regulada pelo Banco Central. As operações são de risco e de responsabilidade do usuário.' },
    { q: 'Como funciona a blockchain do PLAY MY?', a: 'Usamos uma rede interna própria, desconectada do BTC Central, que registra cada investimento, royalty e trade em blocos encadeados com hash SHA-256. Você pode auditar tudo na seção "Blockchain" do app.' },
    { q: 'Posso sacar meu dinheiro?', a: 'Sim. Você pode solicitar saque via PIX quando tiver saldo disponível. O prazo e as taxas seguem o que está nos Termos de Uso.' },
    { q: 'Como faço para investir?', a: 'Passo 1: crie sua conta. Passo 2: adicione saldo via PIX ou cartão. Passo 3: escolha uma música do Selo MIV no Marketplace. Passo 4: clique em "Investir" e escolha a quantidade de ações.' },
    { q: 'Qual o valor mínimo para investir?', a: 'Cada música tem seu próprio valor por ação. Hoje, os valores começam em torno de R$ 10 por ação. Você escolhe quantas quer comprar.' },
    { q: 'Posso vender minhas ações?', a: 'Sim, através do sistema de Negociações. Você pode criar uma oferta de venda e outro usuário compra. Também é possível aceitar ofertas de compra de outros usuários.' },
    { q: 'O que acontece se a música não tocar?', a: 'Se a música não gerar streams, os royalties são baixos ou zero. Nesse caso, suas ações podem desvalorizar. É o risco do investimento em música — algumas músicas estouram, outras não.' },
    { q: 'De onde vêm os royalties?', a: 'Os royalties vêm de streaming (plays nas plataformas parceiras), vendas, shows e licenciamento das músicas do Selo MIV. Parte disso é distribuída entre os investidores, proporcional ao número de ações.' },
    { q: 'Quem são os artistas do PLAY MY?', a: 'Hoje, o artista principal é Elzo Henschell, do Selo MIV. Estamos em processo de cadastrar mais artistas do próprio selo. Se você é artista e quer participar, fale com a gente: selomiv@gmail.com.' },
    { q: 'Como sei que o PLAY MY é confiável?', a: 'Somos transparentes: CNPJ ativo (Selo MIV Produções), e-mail público, endereço, equipe identificada e blockchain auditável. Ainda estamos em beta, então recomendamos começar com valores pequenos.' },
    { q: 'Posso usar no celular?', a: 'Sim! O PLAY MY é um PWA (aplicativo web progressivo). Você pode instalar no celular ou PC pelo próprio navegador. No Chrome/Android, aparece "Instalar app". No iPhone, use "Adicionar à Tela de Início".' },
    { q: 'Quando sai da versão beta?', a: 'Não temos data exata. Estamos ouvindo feedback dos primeiros usuários para corrigir bugs, melhorar a experiência e ampliar o catálogo do Selo MIV. A previsão é lançar a versão 1.0 em breve.' },
    { q: 'Como reporto um bug ou dou sugestão?', a: 'Manda e-mail para selomiv@gmail.com com o assunto "Feedback Beta" e descreve o que aconteceu (print ajuda muito). Todo feedback é lido.' }
  ];

  // ============================================================
  // 1. RODAPÉ (LOGADO)
  // ============================================================
  function injetarRodape() {
    if (document.getElementById('pm-brand-footer')) return;

    var footer = document.createElement('footer');
    footer.id = 'pm-brand-footer';
    footer.style.cssText =
      'background:#0a0a0a;border-top:1px solid #1c1c1e;' +
      'padding:40px 20px 30px;margin-top:60px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'color:#8e8e93;font-size:13px;line-height:1.6';

    footer.innerHTML =
      '<div style="max-width:1100px;margin:0 auto 24px;background:rgba(255,204,0,0.1);' +
        'border-left:3px solid #ffcc00;padding:12px 16px;border-radius:8px;font-size:13px">' +
        '<strong style="color:#ffcc00">⚠️ Versão Beta ' + BRAND.versao_app + '</strong> — ' +
        'Hoje negociamos apenas músicas do catálogo do <strong style="color:#fff">' + BRAND.catalogo.nome + '</strong>. ' +
        '<a href="#" onclick="event.preventDefault();pmBrandAbrirFaq()" style="color:#ffcc00;text-decoration:underline">Ver FAQ</a>' +
      '</div>' +

      '<div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:32px">' +

        '<div>' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
            '<img src="/images/logo.png" alt="PLAY MY" width="32" height="32" ' +
              'style="border-radius:22.5%;object-fit:cover" onerror="this.style.display=\'none\'">' +
            '<span style="color:#fff;font-weight:700;font-size:16px">PLAY MY</span>' +
          '</div>' +
          '<p style="margin:0 0 12px 0">Música sem limites. Streaming, investimento e royalties em uma só plataforma.</p>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            (BRAND.redes.instagram ? '<a href="' + BRAND.redes.instagram + '" target="_blank" rel="noopener" title="Instagram" style="color:#ffcc00;text-decoration:none;font-size:18px">📷</a>' : '') +
            (BRAND.redes.facebook  ? '<a href="' + BRAND.redes.facebook  + '" target="_blank" rel="noopener" title="Facebook"  style="color:#ffcc00;text-decoration:none;font-size:18px">📘</a>' : '') +
            (BRAND.redes.youtube   ? '<a href="' + BRAND.redes.youtube   + '" target="_blank" rel="noopener" title="YouTube"   style="color:#ffcc00;text-decoration:none;font-size:18px">▶️</a>' : '') +
          '</div>' +
        '</div>' +

        '<div>' +
          '<h4 style="color:#fff;font-size:14px;margin:0 0 12px 0;font-weight:700">Plataforma</h4>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            '<a href="#" onclick="event.preventDefault();pmBrandAbrirSobre()" style="color:#8e8e93;text-decoration:none">Sobre nós</a>' +
            '<a href="#" onclick="event.preventDefault();pmBrandAbrirComoFunciona()" style="color:#8e8e93;text-decoration:none">Como funciona</a>' +
            '<a href="#" onclick="event.preventDefault();pmBrandAbrirFaq()" style="color:#8e8e93;text-decoration:none">FAQ (Beta)</a>' +
            '<a href="#" onclick="event.preventDefault();pmBrandAbrirBlockchain()" style="color:#8e8e93;text-decoration:none">Blockchain</a>' +
            '<a href="/termos-de-uso.pdf" target="_blank" style="color:#8e8e93;text-decoration:none">Termos de uso</a>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<h4 style="color:#fff;font-size:14px;margin:0 0 12px 0;font-weight:700">Contato</h4>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            '<a href="mailto:' + BRAND.email + '" style="color:#8e8e93;text-decoration:none;word-break:break-all">' + BRAND.email + '</a>' +
            '<a href="mailto:' + BRAND.email_suporte + '" style="color:#8e8e93;text-decoration:none;word-break:break-all">' + BRAND.email_suporte + '</a>' +
            '<span>' + BRAND.endereco + '</span>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<h4 style="color:#fff;font-size:14px;margin:0 0 12px 0;font-weight:700">Institucional</h4>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' +
            '<span><strong style="color:#c7c7cc">' + BRAND.razao_social + '</strong></span>' +
            '<span>CNPJ: ' + BRAND.cnpj + '</span>' +
            '<span style="font-size:12px;color:#6c6c70">Catálogo: ' + BRAND.catalogo.nome + '</span>' +
            '<span style="font-size:12px;color:#6c6c70">' + BRAND.blockchain.nome + '</span>' +
          '</div>' +
        '</div>' +

      '</div>' +

      '<div style="max-width:1100px;margin:32px auto 0;padding-top:20px;border-top:1px solid #1c1c1e;' +
        'display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:13px">' +
        '<span style="color:#c7c7cc;font-weight:600">' + BRAND.redes_artista.nome + ':</span>' +
        '<a href="' + BRAND.redes_artista.instagram + '" target="_blank" rel="noopener" style="color:#8e8e93;text-decoration:none">Instagram</a>' +
        '<a href="' + BRAND.redes_artista.facebook  + '" target="_blank" rel="noopener" style="color:#8e8e93;text-decoration:none">Facebook</a>' +
        '<a href="' + BRAND.redes_artista.youtube   + '" target="_blank" rel="noopener" style="color:#8e8e93;text-decoration:none">YouTube</a>' +
      '</div>' +

      '<div style="max-width:1100px;margin:32px auto 0;padding-top:20px;border-top:1px solid #1c1c1e;' +
        'display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;font-size:12px;color:#6c6c70">' +
        '<span>© ' + BRAND.ano + ' ' + BRAND.razao_social + '. Todos os direitos reservados.</span>' +
        '<span>v' + BRAND.versao + ' (' + BRAND.versao_app + ') • Feito com 🎵 no Brasil</span>' +
      '</div>';

    document.body.appendChild(footer);
  }

  // ============================================================
  // 1.1. RODAPÉ NA TELA DE LOGIN (compacto)
  // ============================================================
  function injetarRodapeLogin() {
    if (document.getElementById('pm-brand-footer-login')) return;

    var div = document.createElement('div');
    div.id = 'pm-brand-footer-login';
    div.style.cssText =
      'margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'color:#8e8e93;font-size:12px;line-height:1.6;text-align:center;max-width:420px';

    div.innerHTML =
      '<div style="background:rgba(255,204,0,0.1);border-left:3px solid #ffcc00;' +
        'padding:10px 12px;border-radius:8px;font-size:12px;text-align:left;margin-bottom:16px">' +
        '<strong style="color:#ffcc00">⚠️ Versão Beta ' + BRAND.versao_app + '</strong> — ' +
        'Hoje negociamos apenas músicas do catálogo do <strong style="color:#fff">' + BRAND.catalogo.nome + '</strong>.' +
      '</div>' +

      '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-bottom:16px">' +
        '<a href="#" onclick="event.preventDefault();pmBrandAbrirSobre()" style="color:#ffcc00;text-decoration:none">Sobre</a>' +
        '<span style="color:#3a3a3c">•</span>' +
        '<a href="#" onclick="event.preventDefault();pmBrandAbrirComoFunciona()" style="color:#ffcc00;text-decoration:none">Como funciona</a>' +
        '<span style="color:#3a3a3c">•</span>' +
        '<a href="#" onclick="event.preventDefault();pmBrandAbrirFaq()" style="color:#ffcc00;text-decoration:none">FAQ</a>' +
        '<span style="color:#3a3a3c">•</span>' +
        '<a href="#" onclick="event.preventDefault();pmBrandAbrirBlockchain()" style="color:#ffcc00;text-decoration:none">Blockchain</a>' +
      '</div>' +

      '<div style="margin-bottom:12px">' +
        '<div style="color:#c7c7cc;font-weight:600">' + BRAND.razao_social + '</div>' +
        '<div>CNPJ: ' + BRAND.cnpj + '</div>' +
        '<div>' + BRAND.endereco + '</div>' +
      '</div>' +

      '<div style="display:flex;gap:14px;justify-content:center;margin-bottom:12px">' +
        (BRAND.redes.instagram ? '<a href="' + BRAND.redes.instagram + '" target="_blank" rel="noopener" title="Instagram" style="color:#ffcc00;text-decoration:none;font-size:16px">📷</a>' : '') +
        (BRAND.redes.facebook  ? '<a href="' + BRAND.redes.facebook  + '" target="_blank" rel="noopener" title="Facebook"  style="color:#ffcc00;text-decoration:none;font-size:16px">📘</a>' : '') +
        (BRAND.redes.youtube   ? '<a href="' + BRAND.redes.youtube   + '" target="_blank" rel="noopener" title="YouTube"   style="color:#ffcc00;text-decoration:none;font-size:16px">▶️</a>' : '') +
      '</div>' +

      '<div style="font-size:11px;color:#6c6c70">' +
        '© ' + BRAND.ano + ' ' + BRAND.razao_social + ' • v' + BRAND.versao + ' (' + BRAND.versao_app + ')' +
      '</div>';

    var authScreen = document.getElementById('authScreen');
    if (authScreen) {
      authScreen.appendChild(div);
    } else {
      document.body.appendChild(div);
    }
  }

  // ============================================================
  // 2. MODAL "SOBRE"
  // ============================================================
  function injetarSobre() {
    if (document.getElementById('pm-brand-sobre')) return;

    var modal = document.createElement('div');
    modal.id = 'pm-brand-sobre';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
      'z-index:99999;padding:20px;overflow-y:auto;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

    modal.innerHTML =
      '<div style="max-width:680px;margin:40px auto;background:#1c1c1e;border:0.5px solid #38383a;' +
        'border-radius:16px;padding:32px;color:#c7c7cc;font-size:15px;line-height:1.7">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
          '<h2 style="color:#fff;margin:0;font-size:24px">Sobre o PLAY MY</h2>' +
          '<button onclick="document.getElementById(\'pm-brand-sobre\').style.display=\'none\'" ' +
            'style="background:transparent;border:none;color:#8e8e93;font-size:24px;cursor:pointer">×</button>' +
        '</div>' +

        '<p><strong style="color:#ffcc00">O que é</strong></p>' +
        '<p>PLAY MY é uma plataforma brasileira em <strong>versão beta</strong> que une ' +
          '<strong>streaming de música</strong>, <strong>investimento em artistas</strong> e ' +
          '<strong>royalties transparentes</strong>. O ouvinte pode participar do sucesso das músicas — ' +
          'e o artista recebe uma forma justa de monetizar sua obra.</p>' +

        '<p><strong style="color:#ffcc00">Nosso catálogo</strong></p>' +
        '<p>' + BRAND.catalogo.descricao + '</p>' +

        '<p><strong style="color:#ffcc00">Nossa missão</strong></p>' +
        '<p>Democratizar o acesso ao mercado musical. Hoje, quem lucra com música são grandes gravadoras. ' +
          'No PLAY MY, o ouvinte vira investidor, o artista recebe direto e a rede interna garante transparência.</p>' +

        '<p><strong style="color:#ffcc00">Quem faz</strong></p>' +
        '<div style="display:grid;gap:12px;margin-bottom:20px">' +
          BRAND.equipe.map(function (p) {
            return '<div style="background:#2c2c2e;padding:14px;border-radius:10px">' +
              '<div style="color:#fff;font-weight:700">' + p.nome + '</div>' +
              '<div style="color:#8e8e93;font-size:13px;margin-bottom:6px">' + p.cargo + '</div>' +
              (p.linkedin ? '<a href="' + p.linkedin + '" target="_blank" rel="noopener" ' +
                'style="color:#ffcc00;font-size:12px;text-decoration:none">LinkedIn →</a>' : '') +
            '</div>';
          }).join('') +
        '</div>' +

        '<p><strong style="color:#ffcc00">Transparência</strong></p>' +
        '<p>Cada investimento, royalty e trade é registrado em <strong>' + BRAND.blockchain.nome + '</strong>. ' +
          'A rede é auditável dentro do próprio PLAY MY, na seção Blockchain.</p>' +

        '<p><strong style="color:#ffcc00">SELO COIN</strong></p>' +
        '<p>' + BRAND.selo.descricao + '</p>' +

        '<p><strong style="color:#ffcc00">Redes oficiais</strong></p>' +
        '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px">' +
          '<a href="' + BRAND.redes.instagram + '" target="_blank" rel="noopener" style="color:#ffcc00;text-decoration:none">📷 Instagram</a>' +
          '<a href="' + BRAND.redes.facebook  + '" target="_blank" rel="noopener" style="color:#ffcc00;text-decoration:none">📘 Facebook</a>' +
          '<a href="' + BRAND.redes.youtube   + '" target="_blank" rel="noopener" style="color:#ffcc00;text-decoration:none">▶️ YouTube</a>' +
        '</div>' +

        '<p><strong style="color:#ffcc00">Contato</strong></p>' +
        '<p>' +
          'E-mail: <a href="mailto:' + BRAND.email + '" style="color:#ffcc00">' + BRAND.email + '</a><br>' +
          'Suporte: <a href="mailto:' + BRAND.email_suporte + '" style="color:#ffcc00">' + BRAND.email_suporte + '</a><br>' +
          'Endereço: ' + BRAND.endereco + '<br>' +
          'CNPJ: ' + BRAND.cnpj +
        '</p>' +

        '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #38383a;' +
          'font-size:12px;color:#6c6c70;text-align:center">' +
          'Última atualização: ' + new Date().toLocaleDateString('pt-BR') +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
  }

  // ============================================================
  // 3. MODAL "COMO FUNCIONA"
  // ============================================================
  function injetarComoFunciona() {
    if (document.getElementById('pm-brand-como')) return;

    var passos = [
      { n: '1', titulo: 'Ouça e descubra',    texto: 'Explore músicas do catálogo do Selo MIV por gênero, artista ou recomendação. Ouça de graça, sem precisar investir.' },
      { n: '2', titulo: 'Escolha uma música', texto: 'Cada música tem "ações" disponíveis. Você vê o valor por ação, percentual disponível e retorno médio.' },
      { n: '3', titulo: 'Invista com saldo',  texto: 'Adicione saldo via PIX ou cartão e compre ações da música. Cada compra é registrada na rede interna.' },
      { n: '4', titulo: 'Receba royalties',   texto: 'Quanto mais a música é ouvida, maior o retorno. Você recebe SELO COIN proporcional à sua participação.' },
      { n: '5', titulo: 'Negocie ou saque',   texto: 'Venda suas ações para outros usuários no mercado interno, ou saque seu saldo via PIX.' }
    ];

    var modal = document.createElement('div');
    modal.id = 'pm-brand-como';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
      'z-index:99999;padding:20px;overflow-y:auto;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

    modal.innerHTML =
      '<div style="max-width:680px;margin:40px auto;background:#1c1c1e;border:0.5px solid #38383a;' +
        'border-radius:16px;padding:32px;color:#c7c7cc;font-size:15px;line-height:1.7">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
          '<h2 style="color:#fff;margin:0;font-size:24px">Como funciona o PLAY MY</h2>' +
          '<button onclick="document.getElementById(\'pm-brand-como\').style.display=\'none\'" ' +
            'style="background:transparent;border:none;color:#8e8e93;font-size:24px;cursor:pointer">×</button>' +
        '</div>' +

        '<div style="background:rgba(255,204,0,0.1);border-left:3px solid #ffcc00;padding:14px 16px;' +
          'border-radius:8px;margin-bottom:24px;font-size:14px">' +
          '<strong style="color:#ffcc00">Catálogo atual:</strong> ' + BRAND.catalogo.nome + ' — ' +
          'hoje só negociamos músicas do catálogo próprio do Selo MIV.' +
        '</div>' +

        '<p style="color:#8e8e93">Em 5 passos simples, você entende como transformar sua paixão por música em investimento.</p>' +

        passos.map(function (p) {
          return '<div style="display:flex;gap:16px;margin-bottom:20px;background:#2c2c2e;padding:16px;border-radius:12px">' +
            '<div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#ffcc00;color:#000;' +
              'display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px">' + p.n + '</div>' +
            '<div>' +
              '<div style="color:#fff;font-weight:700;font-size:16px;margin-bottom:4px">' + p.titulo + '</div>' +
              '<div style="color:#8e8e93;font-size:14px">' + p.texto + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +

        '<div style="background:rgba(255,204,0,0.1);border-left:3px solid #ffcc00;padding:16px;border-radius:8px;margin-top:24px">' +
          '<strong style="color:#ffcc00">⚠️ Aviso importante</strong>' +
          '<p style="margin:8px 0 0 0;font-size:14px">Investir em música envolve risco. ' +
            'Retornos passados não garantem retornos futuros. Invista apenas o que você pode perder. ' +
            'O PLAY MY não garante lucro e não é uma instituição financeira.</p>' +
        '</div>' +

        '<p style="margin-top:24px;color:#8e8e93;font-size:13px">' +
          'Dúvidas? Fale com a gente: <a href="mailto:' + BRAND.email_suporte + '" style="color:#ffcc00">' + BRAND.email_suporte + '</a>' +
        '</p>' +
      '</div>';

    document.body.appendChild(modal);
  }

  // ============================================================
  // 4. MODAL "BLOCKCHAIN"
  // ============================================================
  function injetarBlockchain() {
    if (document.getElementById('pm-brand-blockchain')) return;

    var modal = document.createElement('div');
    modal.id = 'pm-brand-blockchain';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
      'z-index:99999;padding:20px;overflow-y:auto;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

    modal.innerHTML =
      '<div style="max-width:680px;margin:40px auto;background:#1c1c1e;border:0.5px solid #38383a;' +
        'border-radius:16px;padding:32px;color:#c7c7cc;font-size:15px;line-height:1.7">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
          '<h2 style="color:#fff;margin:0;font-size:24px">Blockchain do PLAY MY</h2>' +
          '<button onclick="document.getElementById(\'pm-brand-blockchain\').style.display=\'none\'" ' +
            'style="background:transparent;border:none;color:#8e8e93;font-size:24px;cursor:pointer">×</button>' +
        '</div>' +

        '<p>' + BRAND.blockchain.descricao + '</p>' +

        '<div style="background:#2c2c2e;padding:16px;border-radius:12px;margin:20px 0">' +
          '<div style="color:#8e8e93;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Rede</div>' +
          '<div style="color:#fff;font-weight:700;font-size:16px">' + BRAND.blockchain.nome + '</div>' +
        '</div>' +

        '<p><strong style="color:#ffcc00">O que é registrado?</strong></p>' +
        '<ul style="padding-left:20px">' +
          '<li>Cada investimento (compra de ações)</li>' +
          '<li>Cada pagamento de royalty</li>' +
          '<li>Cada trade entre usuários</li>' +
          '<li>Cada ingresso emitido</li>' +
          '<li>Cada nova música do Selo MIV cadastrada</li>' +
        '</ul>' +

        '<p><strong style="color:#ffcc00">Como auditar</strong></p>' +
        '<p>Qualquer pessoa pode verificar todas as transações na seção <strong>Blockchain</strong> do próprio PLAY MY. ' +
          'É só clicar no menu lateral → "Blockchain".</p>' +

        '<p style="text-align:center;margin:20px 0">' +
          '<button onclick="document.getElementById(\'pm-brand-blockchain\').style.display=\'none\';' +
            'if(typeof openBlockchainExplorer===\'function\')openBlockchainExplorer()" ' +
            'style="display:inline-block;background:#ffcc00;color:#000;padding:12px 24px;border-radius:10px;' +
            'border:none;cursor:pointer;font-weight:700;font-size:15px">' +
            '🔍 Abrir Explorer Interno' +
          '</button>' +
        '</p>' +

        '<p><strong style="color:#ffcc00">Segurança</strong></p>' +
        '<p>Cada bloco é encadeado com hash SHA-256. Nenhum dado é alterado sem registro público. ' +
          'Você é o único dono das suas ações.</p>' +
      '</div>';

    document.body.appendChild(modal);
  }

  // ============================================================
  // 5. MODAL "FAQ"
  // ============================================================
  function injetarFaq() {
    if (document.getElementById('pm-brand-faq')) return;

    var modal = document.createElement('div');
    modal.id = 'pm-brand-faq';
    modal.style.cssText =
      'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
      'z-index:99999;padding:20px;overflow-y:auto;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

    var htmlFaq = FAQ.map(function (item) {
      return '<details style="background:#2c2c2e;border-radius:12px;margin-bottom:10px;overflow:hidden">' +
        '<summary style="padding:16px;cursor:pointer;color:#fff;font-weight:600;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center">' +
          '<span>' + item.q + '</span>' +
          '<span style="color:#ffcc00;font-size:18px;margin-left:12px">＋</span>' +
        '</summary>' +
        '<div style="padding:0 16px 16px 16px;color:#c7c7cc;font-size:14px;line-height:1.7">' + item.a + '</div>' +
      '</details>';
    }).join('');

    modal.innerHTML =
      '<div style="max-width:720px;margin:40px auto;background:#1c1c1e;border:0.5px solid #38383a;' +
        'border-radius:16px;padding:32px;color:#c7c7cc;font-size:15px;line-height:1.7">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
          '<h2 style="color:#fff;margin:0;font-size:24px">❓ FAQ — PLAY MY ' + BRAND.versao_app + '</h2>' +
          '<button onclick="document.getElementById(\'pm-brand-faq\').style.display=\'none\'" ' +
            'style="background:transparent;border:none;color:#8e8e93;font-size:24px;cursor:pointer">×</button>' +
        '</div>' +

        '<div style="background:rgba(255,204,0,0.1);border-left:3px solid #ffcc00;padding:14px 16px;' +
          'border-radius:8px;margin-bottom:24px;font-size:14px">' +
          '<strong style="color:#ffcc00">Estamos em Beta</strong> — ' +
          'Hoje negociamos apenas músicas do catálogo do <strong style="color:#fff">' + BRAND.catalogo.nome + '</strong>. ' +
          'Algumas funções podem mudar, bugs podem aparecer e o catálogo ainda está crescendo. ' +
          'Agradecemos por testar e enviar feedback!' +
        '</div>' +

        '<p style="color:#8e8e93;margin-bottom:20px">' +
          'Clique em cada pergunta para ver a resposta. Se não encontrar o que procura, fale com a gente: ' +
          '<a href="mailto:' + BRAND.email_suporte + '" style="color:#ffcc00">' + BRAND.email_suporte + '</a>' +
        '</p>' +

        htmlFaq +

        '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #38383a;' +
          'font-size:12px;color:#6c6c70;text-align:center">' +
          'Última atualização: ' + new Date().toLocaleDateString('pt-BR') +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
  }

  // ============================================================
  // 6. FUNÇÕES PÚBLICAS
  // ============================================================
  window.pmBrandAbrirSobre = function () {
    var m = document.getElementById('pm-brand-sobre');
    if (m) m.style.display = 'block';
  };

  window.pmBrandAbrirComoFunciona = function () {
    var m = document.getElementById('pm-brand-como');
    if (m) m.style.display = 'block';
  };

  window.pmBrandAbrirBlockchain = function () {
    var m = document.getElementById('pm-brand-blockchain');
    if (m) m.style.display = 'block';
  };

  window.pmBrandAbrirFaq = function () {
    var m = document.getElementById('pm-brand-faq');
    if (m) m.style.display = 'block';
  };

  document.addEventListener('click', function (e) {
    ['pm-brand-sobre', 'pm-brand-como', 'pm-brand-blockchain', 'pm-brand-faq'].forEach(function (id) {
      var m = document.getElementById(id);
      if (m && e.target === m) m.style.display = 'none';
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['pm-brand-sobre', 'pm-brand-como', 'pm-brand-blockchain', 'pm-brand-faq'].forEach(function (id) {
        var m = document.getElementById(id);
        if (m) m.style.display = 'none';
      });
    }
  });

  // ============================================================
  // 7. INICIALIZAÇÃO
  // ============================================================
  function init() {
    if (!document.body) {
      setTimeout(init, 200);
      return;
    }

    // Modais funcionam em qualquer tela
    injetarSobre();
    injetarComoFunciona();
    injetarBlockchain();
    injetarFaq();

    // Rodapé: logado OU login
    if (document.getElementById('mainApp')) {
      injetarRodape();
    } else if (document.getElementById('authScreen')) {
      injetarRodapeLogin();
    } else {
      setTimeout(init, 500);
      return;
    }

    console.log('✅ [brand-info.js] v' + BRAND.versao + ' injetado (' + FAQ.length + ' FAQs)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
