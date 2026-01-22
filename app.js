/* Agenda Zen com Backup - PWA */
(() => {
  "use strict";

  // PWA registration
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  // Dados da aplicação
  let dados = {
    foco: "",
    tarefas: [],
    notas: [],
    settings: { ultimoBackup: new Date().toISOString(), tema: "claro" }
  };

  let tipoRelatorioAtual = null;

  // helpers
  const esc = (s="") => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const $ = (id) => document.getElementById(id);

  // ========== BACKUP ==========
  window.exportarBackup = function exportarBackup() {
    try {
      dados.settings.ultimoBackup = new Date().toISOString();
      salvarDadosLocal();

      const backupData = {
        ...dados,
        metadata: {
          versao: "1.0",
          dataExportacao: new Date().toISOString(),
          totalTarefas: dados.tarefas.length,
          totalNotas: dados.notas.length
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda_zen_backup_${formatarDataArquivo()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      mostrarMensagem("Backup exportado com sucesso! ✅", "success");
      atualizarUltimoBackup();
    } catch (erro) {
      console.error("Erro ao exportar backup:", erro);
      mostrarMensagem("Erro ao exportar backup", "error");
    }
  };

  window.abrirModalImportar = function abrirModalImportar() {
    $("modal-importar").style.display = "flex";
    $("arquivo-backup").value = "";
  };

  window.fecharModal = function fecharModal() {
    $("modal-importar").style.display = "none";
  };

  window.importarBackup = function importarBackup() {
    const input = $("arquivo-backup");
    const file = input.files[0];

    if (!file) {
      mostrarMensagem("Selecione um arquivo primeiro!", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const conteudo = JSON.parse(e.target.result);
        const tipo = document.querySelector('input[name="tipo-importacao"]:checked').value;

        if (!validarBackup(conteudo)) {
          mostrarMensagem("Arquivo de backup inválido!", "error");
          return;
        }

        if (tipo === "sobrescrever") {
          dados = {
            ...conteudo,
            settings: { ...(conteudo.settings || {}), ultimoBackup: new Date().toISOString() }
          };
          mostrarMensagem("Backup importado com sucesso! Todos os dados foram substituídos.", "success");
        } else {
          const novasTarefas = (conteudo.tarefas || []).filter(t => !dados.tarefas.some(et => et.id === t.id));
          const novasNotas = (conteudo.notas || []).filter(n => !dados.notas.some(en => en.id === n.id));

          dados.tarefas = [...dados.tarefas, ...novasTarefas];
          dados.notas = [...dados.notas, ...novasNotas];
          dados.foco = conteudo.foco || dados.foco;

          mostrarMensagem(`Backup importado! ${novasTarefas.length} tarefas e ${novasNotas.length} notas adicionadas.`, "success");
        }

        salvarDadosLocal();
        atualizarTudo();
        fecharModal();
        atualizarUltimoBackup();
      } catch (erro) {
        console.error("Erro ao importar backup:", erro);
        mostrarMensagem("Erro ao ler arquivo de backup", "error");
      }
    };
    reader.readAsText(file);
  };

  function validarBackup(d) {
    try {
      return d && typeof d === "object" && Array.isArray(d.tarefas) && Array.isArray(d.notas) && typeof d.settings === "object";
    } catch { return false; }
  }

  function atualizarUltimoBackup() {
    const el = $("ultimo-backup");
    if (el && dados.settings?.ultimoBackup) el.textContent = new Date(dados.settings.ultimoBackup).toLocaleString("pt-BR");
  }

  function backupAutomatico() {
    dados.settings.ultimoBackup = new Date().toISOString();
    salvarDadosLocal();
  }

  // ========== STORAGE ==========
  function carregarDadosLocal() {
    try {
      const salvo = localStorage.getItem("agenda-zen-com-backup");
      if (salvo) dados = JSON.parse(salvo);
    } catch {}
  }

  function salvarDadosLocal() {
    try {
      localStorage.setItem("agenda-zen-com-backup", JSON.stringify(dados));
      return true;
    } catch (erro) {
      console.error("Erro ao salvar dados:", erro);
      mostrarMensagem("Erro ao salvar dados localmente", "error");
      return false;
    }
  }

  // ========== UI ==========
  window.mostrarAba = function mostrarAba(nome) {
    document.querySelectorAll(".content").forEach(aba => aba.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(nome).classList.add("active");

    document.querySelectorAll(".tab").forEach(tab => {
      if (tab.textContent.includes(
        nome === "hoje" ? "Hoje" :
        nome === "tarefas" ? "Tarefas" :
        nome === "notas" ? "Notas" : "Relatório"
      )) tab.classList.add("active");
    });

    if (nome === "hoje") atualizarHoje();
    if (nome === "tarefas") atualizarTarefas();
    if (nome === "notas") atualizarNotas();
  };

  function atualizarTudo() {
    atualizarHoje();
    atualizarTarefas();
    atualizarNotas();
    atualizarUltimoBackup();
    atualizarDica();
  }

  // ========== HOJE ==========
  function atualizarHoje() {
    const focoEl = $("foco-texto");
    if (dados.foco) {
      focoEl.innerHTML = `<strong>"${esc(dados.foco)}"</strong>`;
      focoEl.style.color = "#4361ee";
    } else {
      focoEl.textContent = "Clique no botão para definir seu foco principal";
      focoEl.style.color = "#666";
    }

    const hoje = new Date().toISOString().split("T")[0];
    const tarefasHoje = dados.tarefas.filter(t => t.data === hoje);
    const container = $("tarefas-hoje");

    if (tarefasHoje.length === 0) {
      container.innerHTML = `
        <div class="task">
          <input type="checkbox" class="checkbox" disabled>
          <div class="task-text">Nenhuma tarefa para hoje</div>
        </div>`;
    } else {
      container.innerHTML = tarefasHoje.map(tarefa => `
        <div class="task" data-id="${tarefa.id}">
          <input type="checkbox" class="checkbox" ${tarefa.feita ? "checked" : ""} onchange="marcarComoFeita(${tarefa.id})">
          <div class="task-text ${tarefa.feita ? "done" : ""}">
            ${esc(tarefa.texto)}
            ${tarefa.importante ? '<span class="task-priority priority-important">⭐ Importante</span>' : ""}
            ${tarefa.urgente ? '<span class="task-priority priority-urgent">🚨 Urgente</span>' : ""}
          </div>
          <button onclick="excluirTarefa(${tarefa.id})" class="danger" style="padding: 8px 15px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `).join("");
    }

    atualizarProgresso();
  }

  window.definirFoco = function definirFoco() {
    const novoFoco = prompt("Qual é seu foco principal hoje?", dados.foco || "");
    if (novoFoco !== null) {
      dados.foco = String(novoFoco).trim();
      salvarDadosLocal();
      atualizarHoje();
      mostrarMensagem("Foco definido com sucesso! 🎯", "success");
      backupAutomatico();
    }
  };

  window.novaTarefaRapida = function novaTarefaRapida() {
    const texto = prompt("Qual tarefa para hoje?");
    if (texto && String(texto).trim()) {
      dados.tarefas.push({
        id: Date.now(),
        texto: String(texto).trim(),
        feita: false,
        importante: false,
        urgente: false,
        data: new Date().toISOString().split("T")[0]
      });
      salvarDadosLocal();
      atualizarHoje();
      mostrarMensagem("Tarefa adicionada! ✅", "success");
      backupAutomatico();
    }
  };

  // ========== TAREFAS ==========
  function atualizarTarefas() {
    const container = $("lista-tarefas");
    if (dados.tarefas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-tasks" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.3;"></i>
          <p>Nenhuma tarefa ainda</p>
          <p style="margin-top: 10px; font-size: 0.9rem;">Adicione sua primeira tarefa!</p>
        </div>`;
      return;
    }

    const tarefasOrdenadas = [...dados.tarefas].sort((a,b) => {
      if (a.feita !== b.feita) return a.feita ? 1 : -1;
      if (a.urgente !== b.urgente) return b.urgente ? 1 : -1;
      if (a.importante !== b.importante) return b.importante ? 1 : -1;
      return new Date(b.data) - new Date(a.data);
    });

    container.innerHTML = tarefasOrdenadas.map(tarefa => `
      <div class="task" data-id="${tarefa.id}">
        <input type="checkbox" class="checkbox" ${tarefa.feita ? "checked" : ""} onchange="marcarComoFeita(${tarefa.id})">
        <div class="task-text ${tarefa.feita ? "done" : ""}">
          ${esc(tarefa.texto)}
          ${tarefa.importante ? '<span class="task-priority priority-important">⭐ Importante</span>' : ""}
          ${tarefa.urgente ? '<span class="task-priority priority-urgent">🚨 Urgente</span>' : ""}
          <br>
          <small style="color: #888; font-size: 0.9rem;">
            <i class="far fa-calendar"></i> ${formatarData(tarefa.data)}
          </small>
        </div>
        <button onclick="excluirTarefa(${tarefa.id})" class="danger" style="padding: 8px 15px;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join("");
  }

  window.adicionarTarefa = function adicionarTarefa() {
    const input = $("nova-tarefa-input");
    const texto = input.value.trim();
    if (!texto) {
      mostrarMensagem("Digite uma tarefa primeiro!", "warning");
      input.focus();
      return;
    }
    const prioridade = $("prioridade").value;

    dados.tarefas.push({
      id: Date.now(),
      texto,
      feita: false,
      importante: prioridade === "importante",
      urgente: prioridade === "urgente",
      data: new Date().toISOString().split("T")[0]
    });

    salvarDadosLocal();
    input.value = "";
    atualizarTarefas();
    atualizarHoje();
    mostrarMensagem("Tarefa adicionada com sucesso! ✅", "success");
    backupAutomatico();
  };

  window.limparFormularioTarefa = function limparFormularioTarefa() {
    $("nova-tarefa-input").value = "";
    $("prioridade").value = "normal";
  };

  window.marcarComoFeita = function marcarComoFeita(id) {
    const tarefa = dados.tarefas.find(t => t.id === id);
    if (tarefa) {
      tarefa.feita = !tarefa.feita;
      salvarDadosLocal();
      atualizarHoje();
      atualizarTarefas();
      mostrarMensagem(tarefa.feita ? "Tarefa concluída! 🎉" : "Tarefa marcada como pendente", "success");
      backupAutomatico();
    }
  };

  window.excluirTarefa = function excluirTarefa(id) {
    if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
      dados.tarefas = dados.tarefas.filter(t => t.id !== id);
      salvarDadosLocal();
      atualizarTarefas();
      atualizarHoje();
      mostrarMensagem("Tarefa excluída", "info");
      backupAutomatico();
    }
  };

  // ========== NOTAS ==========
  function atualizarNotas() {
    const container = $("lista-notas");
    if (dados.notas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="fas fa-sticky-note" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.3;"></i>
          <p>Nenhuma nota ainda</p>
          <p style="margin-top: 10px; font-size: 0.9rem;">Adicione sua primeira nota!</p>
        </div>`;
      return;
    }

    container.innerHTML = dados.notas.map(nota => `
      <div class="note">
        <div class="note-title">${esc(nota.titulo)}</div>
        <div class="note-content">${esc(nota.texto)}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <small style="color: #888;">
            <i class="far fa-calendar"></i> ${formatarData(nota.data)}
          </small>
          <button onclick="excluirNota(${nota.id})" class="danger" style="padding: 6px 12px; font-size: 0.9rem;">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </div>
      </div>
    `).join("");
  }

  window.salvarNota = function salvarNota() {
    const titulo = $("titulo-nota").value.trim();
    const texto = $("texto-nota").value.trim();

    if (!titulo || !texto) {
      mostrarMensagem("Preencha o título e o conteúdo!", "warning");
      return;
    }
    if (texto.length > 500) {
      mostrarMensagem("A nota deve ter no máximo 500 caracteres!", "warning");
      return;
    }

    dados.notas.unshift({ id: Date.now(), titulo, texto, data: new Date().toISOString().split("T")[0] });
    salvarDadosLocal();

    $("titulo-nota").value = "";
    $("texto-nota").value = "";
    $("contador-caracteres").textContent = "0/500 caracteres";

    atualizarNotas();
    mostrarMensagem("Nota salva com sucesso! 📝", "success");
    backupAutomatico();
  };

  window.excluirNota = function excluirNota(id) {
    if (confirm("Tem certeza que deseja excluir esta nota?")) {
      dados.notas = dados.notas.filter(n => n.id !== id);
      salvarDadosLocal();
      atualizarNotas();
      mostrarMensagem("Nota excluída", "info");
      backupAutomatico();
    }
  };

  // ========== PDF ==========
  window.gerarRelatorio = function gerarRelatorio(tipo) {
    tipoRelatorioAtual = tipo;
    let conteudo = "";
    const hoje = new Date().toISOString().split("T")[0];

    if (tipo === "diario") {
      const tarefasHoje = dados.tarefas.filter(t => t.data === hoje);
      const feitas = tarefasHoje.filter(t => t.feita).length;
      const total = tarefasHoje.length;
      const progresso = total > 0 ? Math.round((feitas / total) * 100) : 0;

      conteudo = `
        <h3 style="color: #4361ee;">📅 Relatório Diário</h3>
        <p><strong>Data:</strong> ${formatarDataExtenso()}</p>
        <p><strong>Foco do dia:</strong> ${esc(dados.foco || "Não definido")}</p>
        <hr>
        <p><strong>Progresso:</strong> ${feitas}/${total} tarefas (${progresso}%)</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          ${progresso === 100 ? "🎉 Dia concluído!" : "💪 Continue assim!"}
        </div>
        <h4>Tarefas de Hoje:</h4>
        ${tarefasHoje.length > 0 ? tarefasHoje.map(t => `
          <p>${t.feita ? "✅" : "⭕"} ${esc(t.texto)}
          ${t.importante ? '<span style="color: #f59e0b;">⭐</span>' : ""}
          ${t.urgente ? '<span style="color: #ef4444;">🚨</span>' : ""}</p>
        `).join("") : '<p style="color: #666;">Nenhuma tarefa para hoje</p>'}
      `;
    } else if (tipo === "semanal") {
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
      const dataLimite = umaSemanaAtras.toISOString().split("T")[0];

      const tarefasSemana = dados.tarefas.filter(t => t.data >= dataLimite);
      const feitasSemana = tarefasSemana.filter(t => t.feita).length;
      const totalSemana = tarefasSemana.length;
      const progressoSemana = totalSemana > 0 ? Math.round((feitasSemana / totalSemana) * 100) : 0;

      conteudo = `
        <h3 style="color: #4361ee;">📊 Relatório Semanal</h3>
        <p><strong>Período:</strong> Últimos 7 dias</p>
        <hr>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
          <div style="background: #f0f5ff; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #4361ee;">${totalSemana}</div>
            <div>Tarefas</div>
          </div>
          <div style="background: #f0f5ff; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 2rem; font-weight: bold; color: #4cc9f0;">${progressoSemana}%</div>
            <div>Conclusão</div>
          </div>
        </div>
        <p><strong>Foco principal:</strong> ${esc(dados.foco || "Não definido")}</p>
        <h4>Tarefas Recentes:</h4>
        ${tarefasSemana.length > 0 ? tarefasSemana.slice(0,10).map(t => `
          <p>${t.feita ? "✅" : "⭕"} ${formatarData(t.data)} - ${esc(t.texto)}</p>
        `).join("") : '<p style="color: #666;">Nenhuma tarefa na semana</p>'}
      `;
    } else {
      conteudo = `
        <h3 style="color: #4361ee;">📋 Relatório Completo</h3>
        <p><strong>Gerado em:</strong> ${formatarDataExtenso()}</p>
        <hr>
        <h4>📊 Resumo Geral</h4>
        <p>Total de tarefas: ${dados.tarefas.length}</p>
        <p>Total de notas: ${dados.notas.length}</p>
        <p>Foco atual: ${esc(dados.foco || "Não definido")}</p>
        <h4>📝 Últimas Tarefas</h4>
        ${dados.tarefas.slice(0,15).map(t => `
          <p>${t.feita ? "✅" : "⭕"} ${formatarData(t.data)} - ${esc(t.texto)}</p>
        `).join("")}
        <h4>📓 Últimas Notas</h4>
        ${dados.notas.slice(0,5).map(n => `
          <p><strong>${esc(n.titulo)}</strong><br><small>${esc(n.texto).substring(0,100)}...</small></p>
        `).join("")}
      `;
    }

    $("preview-pdf").innerHTML = conteudo;
    mostrarMensagem("Preview gerado! Clique em 'Baixar PDF'", "success");
    backupAutomatico();
  };

  window.baixarPDF = function baixarPDF() {
    if (!tipoRelatorioAtual) {
      mostrarMensagem("Gere um relatório primeiro!", "warning");
      return;
    }
    try {
      if (typeof jspdf !== "undefined") {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();

        doc.setFont("helvetica");
        doc.setFontSize(24);
        doc.setTextColor(67, 97, 238);
        doc.text("Agenda Zen", 105, 25, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text(`Relatório ${tipoRelatorioAtual === "diario" ? "Diário" : tipoRelatorioAtual === "semanal" ? "Semanal" : "Completo"}`, 105, 35, { align: "center" });

        doc.setFontSize(11);
        doc.text(`Gerado em: ${formatarDataExtenso()}`, 105, 45, { align: "center" });

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 50, 190, 50);

        const texto = ($("preview-pdf").innerText || $("preview-pdf").textContent);

        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        const linhas = doc.splitTextToSize(texto, 170);
        let yPos = 60;
        for (let i = 0; i < linhas.length; i++) {
          if (yPos > 270) { doc.addPage(); yPos = 20; }
          doc.text(linhas[i], 20, yPos);
          yPos += 7;
        }

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("Backup automático gerado em: " + new Date().toLocaleString("pt-BR"), 105, 285, { align: "center" });

        doc.save(`agenda_zen_${tipoRelatorioAtual}_${formatarDataArquivo()}.pdf`);
        mostrarMensagem("PDF baixado com sucesso! ✅", "success");
      } else {
        alert("Biblioteca PDF não carregada. Use Ctrl+P para imprimir a página.");
        window.print();
      }
    } catch (erro) {
      console.error("Erro ao gerar PDF:", erro);
      mostrarMensagem("Erro ao gerar PDF. Tente imprimir (Ctrl+P).", "error");
    }
  };

  // ========== UTIL ==========
  function atualizarProgresso() {
    const hoje = new Date().toISOString().split("T")[0];
    const tarefasHoje = dados.tarefas.filter(t => t.data === hoje);

    if (tarefasHoje.length === 0) {
      $("barra-progresso").style.width = "0%";
      $("texto-progresso").textContent = "0%";
      return;
    }

    const feitas = tarefasHoje.filter(t => t.feita).length;
    const progresso = Math.round((feitas / tarefasHoje.length) * 100);

    $("barra-progresso").style.width = progresso + "%";
    $("texto-progresso").textContent = progresso + "%";
  }

  function atualizarDica() {
    const dicas = [
      "Quebre tarefas grandes em partes pequenas!",
      "Comemore cada pequena conquista!",
      "Use o método Pomodoro: 25min foco, 5min pausa",
      "Anote tudo que vier à mente para liberar espaço mental",
      "Comece pela tarefa mais difícil do dia",
      "Respire fundo antes de começar",
      "Progresso, não perfeição!",
      "Faça pausas regulares para recarregar",
      "Mantenha apenas 3 tarefas principais por dia",
      "Visualize sua meta alcançada!",
      "Faça backup regularmente dos seus dados!",
      "Use cores para priorizar suas tarefas"
    ];
    $("dica-texto").textContent = dicas[Math.floor(Math.random() * dicas.length)];
  }

  function formatarData(dataStr) {
    const data = new Date(dataStr);
    const hoje = new Date().toISOString().split("T")[0];
    if (dataStr === hoje) return "Hoje";
    const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    if (dataStr === ontem.toISOString().split("T")[0]) return "Ontem";
    return data.toLocaleDateString("pt-BR");
  }

  function formatarDataExtenso() {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function formatarDataArquivo() {
    const d = new Date();
    return d.getFullYear() + ("0"+(d.getMonth()+1)).slice(-2) + ("0"+d.getDate()).slice(-2) + "_" + ("0"+d.getHours()).slice(-2) + ("0"+d.getMinutes()).slice(-2);
  }

  function mostrarMensagem(texto, tipo = "success") {
    const prev = document.querySelector(".mensagem-flutuante");
    if (prev) prev.remove();

    const msg = document.createElement("div");
    msg.className = "mensagem-flutuante";
    msg.textContent = texto;
    msg.style.cssText = `
      position: fixed; top: 30px; right: 30px;
      background: ${tipo === "success" ? "#4cc9f0" : tipo === "error" ? "#f87171" : "#fbbf24"};
      color: white; padding: 20px 30px; border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 1000; animation: slideInRight 0.4s, fadeOut 0.4s 2.6s;
      font-weight: 600; max-width: 400px; word-break: break-word;
    `;
    document.body.appendChild(msg);

    setTimeout(() => {
      if (msg.parentNode) {
        msg.style.animation = "slideOutRight 0.4s";
        setTimeout(() => msg.parentNode && document.body.removeChild(msg), 400);
      }
    }, 3000);

    if (!document.querySelector("#estilos-animacao")) {
      const estilo = document.createElement("style");
      estilo.id = "estilos-animacao";
      estilo.textContent = `
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      `;
      document.head.appendChild(estilo);
    }
  }

  window.limparDados = function limparDados() {
    if (confirm("⚠️ ATENÇÃO: Isso apagará TODOS os seus dados!\n\nTarefas, notas, foco - tudo será perdido.\n\nDeseja continuar?")) {
      exportarBackup();
      localStorage.removeItem("agenda-zen-com-backup");
      dados = { foco:"", tarefas:[], notas:[], settings:{ ultimoBackup: new Date().toISOString(), tema:"claro" } };
      atualizarTudo();
      mostrarMensagem("Todos os dados foram limpos. Um backup foi gerado automaticamente.", "info");
    }
  };

  // init
  window.addEventListener("load", () => {
    carregarDadosLocal();
    atualizarTudo();

    // jsPDF
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    document.head.appendChild(script);

    if (dados.tarefas.length === 0 && dados.notas.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      dados.tarefas = [
        { id: 1, texto: "Explorar a Agenda Zen (PWA)", feita: true, importante: true, urgente: false, data: today },
        { id: 2, texto: "Fazer backup dos seus dados", feita: false, importante: true, urgente: false, data: today },
        { id: 3, texto: "Definir seu foco do dia", feita: false, importante: true, urgente: false, data: today }
      ];
      dados.notas = [
        { id: 1, titulo: "Bem-vindo!", texto: "Esta é sua primeira nota. Você pode escrever qualquer coisa aqui!\n\nDica: Faça backup regularmente clicando no botão 'Exportar Backup'.", data: today }
      ];
      salvarDadosLocal();
      atualizarTudo();
    }

    setTimeout(() => mostrarMensagem("Agenda Zen (PWA) carregada com sucesso! ✅", "success"), 500);
  });

  window.addEventListener("click", (event) => {
    const modal = $("modal-importar");
    if (event.target === modal) fecharModal();
  });

  $("texto-nota")?.addEventListener("input", function() {
    const contador = $("contador-caracteres");
    const texto = this.value;
    contador.textContent = `${texto.length}/500 caracteres`;
    if (texto.length > 500) { contador.style.color = "#ef4444"; contador.style.fontWeight = "bold"; }
    else if (texto.length > 450) contador.style.color = "#f59e0b";
    else contador.style.color = "#666";
  });

  $("nova-tarefa-input")?.addEventListener("keypress", function(e) {
    if (e.key === "Enter") { e.preventDefault(); adicionarTarefa(); }
  });

  $("titulo-nota")?.addEventListener("keypress", function(e) {
    if (e.key === "Enter") { e.preventDefault(); $("texto-nota").focus(); }
  });
})();
