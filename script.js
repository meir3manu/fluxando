import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ======== CONFIGURAÇÕES E MAPAS ========

const CONFIG = {
  SUPABASE_URL: 'https://ombfusthhrhhhozrkfib.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tYmZ1c3RoaHJoaGhvenJrZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjkzNzMsImV4cCI6MjA4OTIwNTM3M30.jp3vbt01vpxDcSTuOzLNJi3owDz7R1_x1Q-zRKp2bXY',
  PROJECTS: {
    ignicao: { nome: "IGNIÇÃO Petrobras", id: "11111111-1111-1111-1111-111111111111" },
    apple: { nome: "Apple Developer Academy", id: "22222222-2222-2222-2222-222222222222" },
    tic: { nome: "TIC em trilhas", id: "33333333-3333-3333-3333-333333333333" }
  },
  SLA_DIAS: 30,
  PREV_DIAS: 3,
};

const ETAPAS_FLUXO = [
  { id: '1_SOLICITACAO', label: '1. Solicitação Aberta', setor: 'Pesquisador', desc: 'Início do processo informativo.' },
  { id: '2_AUTORIZACAO', label: '2. Autorização da Direção', setor: 'Direção (Nasser)', desc: 'Aprovação ou negação da compra.' },
  { id: '3_SOLICITACAO_COTACAO', label: '3. Solicitação de Cotação', setor: 'ADM / Financeiro', desc: 'Abertura de processo de cotação.' },
  { id: '4_COTACAO', label: '4. Cotação', setor: 'ADM / Financeiro', desc: 'Mínimo de 3 orçamentos necessários.' },
  { id: '5_COMPRAS', label: '5. Compras', setor: 'ADM / Financeiro', desc: 'Efetivação da aquisição.' },
  { id: '6_ENTREGA', label: '6. Entrega', setor: 'Logística', desc: 'Transporte e código de rastreio.' },
  { id: '7_RECEPCAO', label: '7. Recepção', setor: 'Infraestrutura', desc: 'Recebimento físico do item.' },
  { id: '8_PATRIMONIO', label: '8. Patrimônio', setor: 'Infraestrutura', desc: 'Etiquetagem e registro interno.' },
  { id: '9_DISTRIBUICAO', label: '9. Distribuição Final', setor: 'Usuário Final', desc: 'Disponível para entrega e uso.' },
  { id: '10_FINALIZADO', label: '10. Finalização', setor: 'Sistema', desc: 'Processo concluído com sucesso.' }
];

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// ======== UTILITÁRIOS ========

const Utils = {
  getParam: (name) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },

  getCurrentId: () => Utils.getParam('id') || localStorage.getItem('ultimo_id_ecoa'),

  formatDate: (dateStr) => {
    if (!dateStr) return '--/--/--';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  },

  formatCurrency: (value) => {
    const num = parseFloat(value) || 0;
    return num > 0 ? `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ --';
  },

  setLastId: (id) => id && localStorage.setItem('ultimo_id_ecoa', id)
};

// ======== INICIALIZAÇÃO ========

function pegarDataHoje(){
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function checkAuth() {
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html') || path.includes('login');
  const isRegisterPage = path.includes('cadastro.html') || path.includes('cadastro');
  const isIndexPage = path.endsWith('/') || path.includes('index.html');
  const user = sessionStorage.getItem('ecoa_user');

  // Na página index, não redireciona (apenas mostra os cards de projeto)
  if (isIndexPage && !user) return null;

  if (!user && !isLoginPage && !isRegisterPage) {
    // Usa URL completa para funcionar em qualquer hospedagem (GitHub Pages, localhost, etc.)
    const currentUrl = window.location.href;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
    return null;
  }
  return user ? JSON.parse(user) : null;
}

async function init() {
  const currentUser = checkAuth();
  const path = window.location.pathname;
  const isPublicPage = path.endsWith('/') || path.includes('index.html') || path.includes('login') || path.includes('cadastro');
  if (!currentUser && !isPublicPage) return;

  const headerUsername = document.getElementById("header_username")
  headerUsername.innerText = `Olá, ${currentUser.nome}`

  const chave = Utils.getParam('projeto') || localStorage.getItem('ultimo_projeto_ecoa') || 'ignicao';
  localStorage.setItem('ultimo_projeto_ecoa', chave);

  const id = Utils.getCurrentId();
  Utils.setLastId(Utils.getParam('id'));

  const projeto = CONFIG.PROJECTS[chave] || { nome: "Projeto ECOA" };

  // Preencher nome do funcionário logado se estiver no formulário
  const inputNome = document.getElementById('nome_solicitante');
  if (inputNome && currentUser) {
    inputNome.value = currentUser.nome;
    inputNome.readOnly = true;
  }

  if (document.getElementById('nome-projeto')) document.getElementById('nome-projeto').textContent = projeto.nome;

  // Atualizar UI Global
  document.querySelectorAll('#add-solicitacao').forEach(el => el.href = `./formulario.html?projeto=${chave}`);
  document.querySelectorAll('#btn-voltar').forEach(el => {
    if (path.includes('detalhe.html')) {
      el.href = `./solicitacoes.html?projeto=${chave}`;
    } else if (path.includes('solicitacoes.html') || path.includes('formulario.html')) {
      el.href = `./index.html`;
    }
  }); 

  // Carregar dados da página
  if (document.getElementById('btn-tab-ativas')) {
    await carregarSolicitacoes(chave, 'ativas');
    
    // Configurar Abas
    const btnAtivas = document.getElementById('btn-tab-ativas');
    const btnFinalizadas = document.getElementById('btn-tab-finalizadas');
    
    if (btnAtivas && btnFinalizadas) {
      btnAtivas.onclick = () => carregarSolicitacoes(chave, 'ativas');
      btnFinalizadas.onclick = () => carregarSolicitacoes(chave, 'finalizadas');
    }
  }
  
  if (document.getElementById('timeline-container')) {
    await carregarDetalhes(chave, id);
  }
}

// ======== FUNÇÕES DE DADOS ========

async function carregarSolicitacoes(chaveProjeto, tab = 'ativas') {
  const container = document.getElementById('area-solicitacao');
  const projeto = CONFIG.PROJECTS[chaveProjeto];

  if (!projeto) {
    container.innerHTML = `<p class="text-gray-400 text-center py-12 italic">Projeto não identificado.</p>`;
    return;
  }

  // Feedback visual das abas
  const btnAtivas = document.getElementById('btn-tab-ativas');
  const btnFinalizadas = document.getElementById('btn-tab-finalizadas');
  
  if (btnAtivas && btnFinalizadas) {
    if (tab === 'ativas') {
      btnAtivas.className = "active-button button";
      btnFinalizadas.className = "deactive-button button";
    } else {
      btnFinalizadas.className = "active-button button";
      btnAtivas.className = "deactive-button button";
    }
  }

  container.innerHTML = `<div class="flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>`;

  try {
    // Buscar SEM .order() para evitar erro se a coluna não existir
    const { data, error } = await supabase
      .from('solicitacoes')
      .select('*')
      .eq('projeto_id', projeto.id);

    if (error) {
      console.error("Erro Supabase:", error);
      container.innerHTML = `<p class="text-red-400 text-center py-8">Erro: ${error.message}</p>`;
      return;
    }

    // Ordenar no cliente (mais seguro que depender de coluna no DB)
    const sorted = (data || []).sort((a, b) => {
      const da = new Date(a.data_abertura || a.created_at || 0);
      const db = new Date(b.data_abertura || b.created_at || 0);
      return db - da;
    });

    renderizarLista(sorted, container, chaveProjeto, tab);
  } catch (err) {
    console.error("Erro inesperado:", err);
    container.innerHTML = `<p class="text-red-400 text-center py-8">Erro inesperado: ${err.message}</p>`;
  }
}

function renderizarLista(data, container, chaveProjeto, tab) {

  // Filtrar conforme a aba
  const filtrados = data.filter(item => {
    const isFinalizado = item.status_atual === '10_FINALIZADO' || item.status_atual === 'REPROVADO';
    return tab === 'finalizadas' ? isFinalizado : !isFinalizado;
  });

  if (!filtrados?.length) {
    container.innerHTML = `<p class="text-gray-400 text-center py-12 italic">Nenhuma solicitação ${tab === 'ativas' ? 'ativa' : 'finalizada'} encontrada.</p>`;
    return;
  }

  container.innerHTML = filtrados.map(item => {
    const etapa = ETAPAS_FLUXO.find(e => e.id === item.status_atual) || ETAPAS_FLUXO[0];
    const isReprovado = item.status_atual === 'REPROVADO';
    let borderCol = isReprovado ? 'border-red-500' : 'border-[#00D552]';
    if (etapa.label === "10. Finalização")
      borderCol = 'border-[#334367]'

    return `
      <a href="detalhe.html?projeto=${chaveProjeto}&id=${item.id}" 
         onclick="localStorage.setItem('ultimo_id_ecoa', '${item.id}')"
         class="etapa-card border-l-8 ${borderCol}">
        <div class="solicitacao-info flex justify-between items-center">
          <div>
            <span class="font-bold block title">${item.titulo_item}</span>
            <span class="qtd-pc text-gray">Quantidade: ${item.quantidade}</span>
            <span class="qtd-mob text-gray">Qtd.: ${item.quantidade}</span>
          </div>
          <div class="flex items-center justify-space-between gap-3">
            <p class="text-gray"><b>Status:</b> ${isReprovado ? 'NEGADO' : etapa.label}</p>
            <img src="imgs/Vector.svg" width="10px">
          </div>
        </div>
      </a>
    `;
  }).join('');
}

async function carregarDetalhes(chaveProjeto, id) {
  const timeline = document.getElementById('timeline-container');
  if (!id) return;

  try {
    const { data: item, error } = await supabase.from('solicitacoes').select('*').eq('id', id).single();
    if (error || !item) throw new Error("Solicitação não encontrada.");

    // Preencher Header
    const fields = {
      'nome_item': item.titulo_item,
      'qtd_item': `${item.quantidade || 0}`,
      'justificativa_texto': item.justificativa,
      'valor_item': Utils.formatCurrency(item.valor_estimado),
      'data_abertura': Utils.formatDate(item.data_criacao),
      'data_fechamento': Utils.formatDate(item.data_fechamento) || "Em processo",
      'responsavel_atual': item.responsavel_nome || ETAPAS_FLUXO.find(e => e.id === item.status_atual)?.setor
    };

    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '---';
    });

    if (item.data_abertura && document.getElementById('data_previsao')) {
      const prev = new Date(item.data_abertura);
      prev.setDate(prev.getDate() + CONFIG.SLA_DIAS);
      document.getElementById('data_previsao').textContent = prev.toLocaleDateString('pt-BR');
    }

    //renderTimelineVertical(item);
    renderTimeline(item)

  } catch (err) {
    console.error(err);
    if (timeline) timeline.innerHTML = `<p class="text-red-400 text-center py-10">${err.message}</p>`;
  }
}

// ======== RENDERIZAÇÃO TIMELINE ========

function renderTimeline(solicitacao){

  console.log(solicitacao)
  const container = document.getElementById("timeline-container")
  if (!container)
    return

  const historico = solicitacao.historico_fluxo || {};
  const indiceAtual = ETAPAS_FLUXO.findIndex(e => e.id === solicitacao.status_atual);
  const setorAtual = solicitacao.responsavel_nome
  console.log(setorAtual)
  console.log("indice atual: " + indiceAtual)
  const reprovado = solicitacao.status_atual === 'REPROVADO';
  const concluidoGeral = solicitacao.finalizado || solicitacao.status_atual === '10_FINALIZADO';
  
  ETAPAS_FLUXO.map((etapa, index) => {
    const userRaw = sessionStorage.getItem('ecoa_user');
    const currentUser = userRaw ? JSON.parse(userRaw) : null;
    if (!currentUser) throw new Error("Sessão expirada. Faça login novamente.");

    const dadosSalvos = historico[etapa.id] || {}
    console.log(dadosSalvos.data)
    let statusLabel = "-"
    let confirmarNegarBtns = ""
    let iconHtml = ""
    let displayPending = ""
    let enableObservacao = "disabled"
    let negarBtn = ""
    let data = ""
    let responsavel_e_data = ``
    let extraInfo = ``

    const isPast = (index < indiceAtual ? true : false) || concluidoGeral || (index === 0 && reprovado)
    const isCurrent = (index === indiceAtual) || (index === 1 && indiceAtual === -1) && !concluidoGeral
    const isPending = index > indiceAtual ? true : false

    if(isPast)
      statusLabel = "concluido"
    else if (isCurrent){
      if(indiceAtual === -1)
        statusLabel = "negado"
      else
        statusLabel = "processando"
    }
    else
      statusLabel = "aguardando"
    console.log(statusLabel)

    if(statusLabel === "aguardando" || etapa.id === '10_FINALIZADO')
      displayPending = "display-none"

    if (etapa.id === "1_SOLICITACAO")
      data = new Date(solicitacao.data_criacao).toLocaleDateString('pt-BR');
    else
      data = dadosSalvos.data === undefined ? Utils.formatDate(solicitacao.data_abertura) : Utils.formatDate(dadosSalvos.data)

    if(etapa.id === "2_AUTORIZACAO")
      negarBtn = `<button onclick="handleAction(false, '${etapa.id}')" class="status-btn bg-negado">Negar</button>`

    if (statusLabel === "processando")
      iconHtml = `<div class="etapa-icone mob-display-none flex justify-center align-items-center"><img width="50px" src="imgs/${etapa.id}.svg"></div>`
    if(statusLabel === "processando"){
      if(currentUser.setor === etapa.setor.toLowerCase() || currentUser.setor === "dev" || etapa.id === "9_DISTRIBUICAO"){
        confirmarNegarBtns = `<div class="flex justify-end gap-5">
                                <button onclick="handleAction(true, '${etapa.id}')" class="status-btn bg-concluido">Concluir Etapa</button>
                                ${negarBtn}
                              </div>`
        enableObservacao = ""
      }
      let prev = new Date(solicitacao.data_abertura);
      prev.setDate(prev.getDate() + CONFIG.PREV_DIAS);
      prev = prev.toLocaleDateString('pt-BR')
      responsavel_e_data = `<div class="responsavel flex flex-1 gap-2 justify-space-between">
                              <p><b>Setor: </b>${setorAtual || '--'}</p>
                              <p><b>Início: </b>${data || '--'}</p>
                              <p><b>Previsão de término: </b>${prev || '--'}</p>
                            </div>`
    } else{
      let inicioOuTermino = "Previsão de término:"
      let nextData = ''
      if (statusLabel === "concluido" || statusLabel === "negado"){
        inicioOuTermino = 'Término:'
        const next = statusLabel === "concluido" ? 1 : 0
        if(index < ETAPAS_FLUXO.length - 1){
          const proxima = ETAPAS_FLUXO[index + next];
          const nextHist = historico[proxima.id] || {}
          if(nextHist.data)
            nextData = Utils.formatDate(nextHist.data)
          else
            nextData = Utils.formatDate(solicitacao.data_abertura)
        }
      }
      responsavel_e_data = `<div class="responsavel flex flex-1 gap-2 justify-space-between">
                              <p><b>Por: </b>${dadosSalvos.responsavel || '--'}</p>
                              <p><b>Início: </b>${data || '--'}</p>
                              <p><b>${inicioOuTermino} </b>${nextData}</p>
                            </div>`
    }
    
    // Mensagem especial de finalização (Aparece quando o processo termina de fato)
    if (index === 9 && concluidoGeral) {
      extraInfo = `
        <div id="mensagem-finalizada" class="mt-6 bg-gradient-to-br from-teal-500/30 to-teal-700/10 border-2 border-teal-500/50 text-center shadow-[0_0_30px_rgba(20,184,166,0.3)] animate-pulse">
           <div class="bg-teal-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
           </div>
           <p class="text-teal-400 font-black text-xs uppercase tracking-widest mb-1">Solicitação Finalizada</p>
           <p class="text-white font-black text-lg leading-tight">O EQUIPAMENTO ESTÁ DISPONÍVEL PARA USO!</p>
        </div>
      `;
    }

    const template = `
          <!-- ${etapa.id} --!>
          <div id="etapa_${etapa.id}" class="flex gap-5">
            ${iconHtml}
            <div class="etapa-box box-${statusLabel} flex flex-1 direction-column gap-10">
              <div class="equip-info bb-${statusLabel}">
                <div class="mob-flex-col mob-gap-2 mob-align-it-start flex align-items-center justify-space-between">
                  <div class="flex direction-column">
                    <p class="etapa-title">${etapa.label}</p>
                    <p class="etapa-desc">${etapa.desc}</p>
                  </div>
                  <div class="status-btn bg-${statusLabel}">${statusLabel[0].toUpperCase() + statusLabel.substring(1)}</div>
                </div>
              </div>
              ${extraInfo}
              <div class="etapa-info flex direction-column flex-1 gap-10 ${displayPending}">
                <div class="flex flex-1 direction-column gap-2">
                  ${responsavel_e_data}
                  <textarea ${enableObservacao} class="etapa-obs" id="obs-${etapa.id}">${dadosSalvos.observacao || 'Sem obs.'}</textarea>
                </div>
                ${confirmarNegarBtns}
              </div>
            </div>
          </div>
    `
    container.innerHTML += template
  })
}

function renderTimelineVertical(solicitacao) {
  console.log(solicitacao)
  const container = document.getElementById('timeline-container');
  if (!container) return;

  const historico = solicitacao.historico_fluxo || {};
  const indiceAtual = ETAPAS_FLUXO.findIndex(e => e.id === solicitacao.status_atual);
  const reprovado = solicitacao.status_atual === 'REPROVADO';
  const concluidoGeral = solicitacao.finalizado || solicitacao.status_atual === '10_FINALIZADO';

  container.innerHTML = ETAPAS_FLUXO.map((etapa, index) => {
    const dadosSalvos = historico[etapa.id] || {};
    const isCurrent = index === indiceAtual && !reprovado && !concluidoGeral;
    const isPast = index < indiceAtual || (reprovado && index <= 1) || (concluidoGeral && index === indiceAtual);
    
    let statusLabel = "Pendente";
    let statusClass = "border-gray-700 bg-gray-800/20 text-gray-500 opacity-60";

    if (reprovado && index === 1) {
      statusClass = "border-red-500 bg-red-900/20 text-white";
      statusLabel = "Negado";
    } else if (index < indiceAtual || (reprovado && index === 0) || (concluidoGeral && index === 9)) {
      statusClass = "border-teal-500 bg-teal-900/10 text-white";
      statusLabel = "Concluído";
    } else if (isCurrent) {
      statusClass = "border-blue-500 bg-blue-900/20 text-white shadow-lg scale-[1.02]";
      statusLabel = "Atual";
    }

    let extraInfo = '';
    if (index === 0) {
      extraInfo = `
        <div class="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-[10px]">
          <div><p class="text-gray-500 uppercase font-bold">Início</p><p class="text-white">${Utils.formatDate(solicitacao.data_abertura)}</p></div>
          <div><p class="text-gray-500 uppercase font-bold">Por</p><p class="text-white">${solicitacao.responsavel_nome}</p></div>
        </div>`;
    } else if (isCurrent) {
      extraInfo = `
        <div class="mt-4 space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <input type="text" id="in-resp-${etapa.id}" value="${etapa.setor}" class="bg-gray-900 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
            <input type="date" id="in-data-${etapa.id}" value="${new Date().toISOString().split('T')[0]}" class="bg-gray-900 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
          </div>
          <textarea id="in-obs-${etapa.id}" rows="2" class="w-full bg-gray-900 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none resize-none" placeholder="Observações..."></textarea>
        </div>`;
    } else if (isPast) {
      extraInfo = `
        <div class="mt-4 pt-4 border-t border-white/5 text-[9px] text-gray-400 italic">
          <div class="flex justify-between"><span>Resp: ${dadosSalvos.responsavel || '--'}</span><span>Fim: ${dadosSalvos.data || '--'}</span></div>
          <p class="mt-1">"${dadosSalvos.observacao || 'Sem obs.'}"</p>
        </div>`;
    }

    // Mensagem especial de finalização (Aparece quando o processo termina de fato)
    if (index === 9 && concluidoGeral) {
      extraInfo = `
        <div class="mt-6 p-6 bg-gradient-to-br from-teal-500/30 to-teal-700/10 border-2 border-teal-500/50 rounded-3xl text-center shadow-[0_0_30px_rgba(20,184,166,0.3)] animate-pulse">
           <div class="bg-teal-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
           </div>
           <p class="text-teal-400 font-black text-xs uppercase tracking-widest mb-1">Solicitação Finalizada</p>
           <p class="text-white font-black text-lg leading-tight">O EQUIPAMENTO ESTÁ DISPONÍVEL PARA USO!</p>
        </div>
      `;
    }

    let actionBtn = isCurrent ? (etapa.id === '2_AUTORIZACAO' ? 
      `<div class="flex gap-2 mt-4">
        <button onclick="handleAction(true, '${etapa.id}')" class="flex-1 bg-teal-600 py-2 rounded-lg text-xs font-bold">Aprovar</button>
        <button onclick="handleAction(false, '${etapa.id}')" class="flex-1 bg-red-600 py-2 rounded-lg text-xs font-bold">Negar</button>
      </div>` : 
      `<button onclick="handleAction(true, '${etapa.id}')" class="w-full bg-blue-600 py-3 mt-4 rounded-xl text-xs font-bold shadow-xl transition-all active:scale-95">Concluir Etapa →</button>`
    ) : '';

    return `
      <div class="relative p-6 rounded-3xl border-2 mb-6 ${statusClass}">
        <div class="flex justify-between items-center mb-1">
          <h3 class="text-sm font-black uppercase text-white">${etapa.label}</h3>
          <span class="text-[8px] font-bold px-2 py-0.5 rounded-full bg-white/10">${statusLabel}</span>
        </div>
        <p class="text-[9px] text-gray-400">${etapa.desc}</p>
        ${extraInfo}
        ${actionBtn}
      </div>`;
  }).join('');
}

// ======== AÇÕES DO FLUXO ========

async function handleAction(success, etapaId) {
  const userRaw = sessionStorage.getItem('ecoa_user');
  const currentUser = userRaw ? JSON.parse(userRaw) : null;
      
  if (!currentUser) throw new Error("Sessão expirada. Faça login novamente.");
  const id = Utils.getCurrentId();
  if (!id) return alert("Erro: ID ausente.");

  const { data: item } = await supabase.from('solicitacoes').select('*').eq('id', id).single();
  const historico = item.historico_fluxo || {};
  
  historico[etapaId] = {
    responsavel: `${currentUser.nome} (${currentUser.setor || currentUser.papel || " -- "})`, //document.getElementById(`in-resp-${etapaId}`)?.value || '--',
    data: new Date().toISOString().split('T')[0],//document.getElementById(`in-data-${etapaId}`)?.value || '--',
    observacao: document.getElementById(`obs-${etapaId}`)?.value || ''
  };

  const indice = ETAPAS_FLUXO.findIndex(e => e.id === item.status_atual);
  const proxima = ETAPAS_FLUXO[indice + 1];

  let updates = { historico_fluxo: historico, data_abertura: new Date().toISOString().split('T')[0] };

  if (etapaId === '2_AUTORIZACAO') {
    updates.status_atual = success ? '3_SOLICITACAO_COTACAO' : 'REPROVADO';
    updates.responsavel_nome = success ? 'ADM / Financeiro' : 'Direção';
  } else if (proxima) {
    updates.status_atual = proxima.id;
    updates.responsavel_nome = proxima.setor;
    
    // Marcar como finalizado no DB se atingir a última etapa
    if (proxima.id === '10_FINALIZADO') {
      updates.finalizado = true;
    }
    /*
    if (proxima.id === '6_ENTREGA') {
      const track = prompt("Código de rastreio:");
      if (track) updates.codigo_rastreio = track;
    }
    */
  }

  const { error } = await supabase.from('solicitacoes').update(updates).eq('id', id);
  if (error) alert(error.message);
  else location.reload();
}

// ======== FORMULÁRIO ========

const form = document.getElementById('form_nova_solicitacao');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('fluxar_btn');
    btn.disabled = true;
    btn.textContent = "Processando...";

    try {
      const userRaw = sessionStorage.getItem('ecoa_user');
      const currentUser = userRaw ? JSON.parse(userRaw) : null;
      
      if (!currentUser) throw new Error("Sessão expirada. Faça login novamente.");

      const chave = Utils.getParam('projeto') || "ignicao";
      const projeto = CONFIG.PROJECTS[chave];
      if (!projeto) throw new Error("Projeto inválido.");

      const payload = {
        projeto_id: projeto.id,
        titulo_item: document.getElementById('nome_item').value,
        quantidade: parseInt(document.getElementById('quantidade_item').value),
        valor_estimado: parseFloat(document.getElementById('valor_estimado').value),
        data_abertura: document.getElementById('data_abertura').value,
        data_criacao: document.getElementById('data_abertura').value,
        justificativa: document.getElementById('justificativa_item').value,
        status_atual: '2_AUTORIZACAO', //'1_SOLICITACAO',
        historico_fluxo: {
          "1_SOLICITACAO": {
          "data": new Date().toISOString().split('T')[0],
          "observacao": document.getElementById('justificativa_item').value,
          "responsavel": `${currentUser.nome} (${currentUser.setor || currentUser.papel || " -- "})`
          },
        },
        responsavel_nome: 'Direção', //currentUser.nome,
        pesquisador_id: currentUser.id
      };

      const { data, error } = await supabase.from('solicitacoes').insert([payload]).select().single();
      if (error) throw error;

      Utils.setLastId(data.id);
      window.location.href = `detalhe.html?projeto=${chave}&id=${data.id}`;
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
    }
  });
}

// Globais
window.handleAction = handleAction;
init();