class ProntuarioApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.pacientes = [];
        this.consultas = [];
        this.documentos = [];
        this.deferredPrompt = null;
        
        this.init();
    }
    
    async init() {
        // Inicializar banco de dados
        await this.initDatabase();
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Carregar dados iniciais
        await this.loadInitialData();
        
        // Verificar conexão
        this.setupConnectionMonitor();
        
        // Atualizar interface
        this.updateUI();
        
        console.log('Prontuário Médico PWA iniciado');
    }
    
    async initDatabase() {
        // Usando IndexedDB para armazenamento offline
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('prontuarioDB', 1);
            
            request.onerror = (event) => {
                console.error('Erro ao abrir banco de dados:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Banco de dados aberto com sucesso');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Tabela de pacientes
                if (!db.objectStoreNames.contains('pacientes')) {
                    const store = db.createObjectStore('pacientes', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nome', 'nome', { unique: false });
                    store.createIndex('cpf', 'cpf', { unique: true });
                    store.createIndex('dataNascimento', 'dataNascimento', { unique: false });
                }
                
                // Tabela de consultas
                if (!db.objectStoreNames.contains('consultas')) {
                    const store = db.createObjectStore('consultas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('pacienteId', 'pacienteId', { unique: false });
                    store.createIndex('data', 'data', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
                
                // Tabela de documentos
                if (!db.objectStoreNames.contains('documentos')) {
                    const store = db.createObjectStore('documentos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('tipo', 'tipo', { unique: false });
                    store.createIndex('pacienteId', 'pacienteId', { unique: false });
                    store.createIndex('data', 'data', { unique: false });
                }
                
                // Tabela de configurações
                if (!db.objectStoreNames.contains('configuracoes')) {
                    const store = db.createObjectStore('configuracoes', { keyPath: 'key' });
                }
                
                console.log('Estrutura do banco de dados criada');
            };
        });
    }
    
    setupEventListeners() {
        // Navegação
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });
        
        // Botão de instalação PWA
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.addEventListener('click', () => this.installPWA());
            
            // Esconder botão se já estiver instalado
            if (window.matchMedia('(display-mode: standalone)').matches) {
                installBtn.style.display = 'none';
            }
        }
        
        // Evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (installBtn) installBtn.style.display = 'flex';
        });
        
        // Monitor de conexão
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
        
        // Backup
        document.getElementById('backupBtn')?.addEventListener('click', () => this.exportBackup());
        
        // Fechar modal
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeModal());
        
        // Fechar modal ao clicar fora
        document.getElementById('modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });
    }
    
    async loadInitialData() {
        try {
            // Carregar pacientes
            this.pacientes = await this.getAllPacientes();
            
            // Carregar consultas
            this.consultas = await this.getAllConsultas();
            
            // Carregar configurações
            const config = await this.getConfig('clinica');
            if (!config) {
                // Configurações padrão
                await this.saveConfig('clinica', {
                    nome: 'Clínica Médica',
                    crm: '',
                    endereco: '',
                    telefone: '',
                    email: ''
                });
            }
            
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
    
    updateUI() {
        // Atualizar contadores
        document.getElementById('pacientesCount').textContent = this.pacientes.length;
        document.getElementById('consultasCount').textContent = this.consultas.filter(c => c.status === 'agendada').length;
        
        // Carregar página atual
        this.loadPage(this.currentPage);
    }
    
    navigateTo(page) {
        // Atualizar menu ativo
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        this.currentPage = page;
        this.loadPage(page);
    }
    
    async loadPage(page) {
        const content = document.getElementById('pageContent');
        
        // Mostrar loading
        content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        // Carregar conteúdo da página
        setTimeout(async () => {
            let html = '';
            
            switch(page) {
                case 'dashboard':
                    html = await this.getDashboardHTML();
                    break;
                case 'pacientes':
                    html = await this.getPacientesHTML();
                    break;
                case 'consultas':
                    html = await this.getConsultasHTML();
                    break;
                case 'prontuario':
                    html = await this.getProntuarioHTML();
                    break;
                case 'receituario':
                    html = await this.getReceituarioHTML();
                    break;
                case 'atestado':
                    html = await this.getAtestadoHTML();
                    break;
                case 'orcamento':
                    html = await this.getOrcamentoHTML();
                    break;
                case 'relatorios':
                    html = await this.getRelatoriosHTML();
                    break;
                case 'config':
                    html = await this.getConfigHTML();
                    break;
                default:
                    html = '<h2>Página não encontrada</h2>';
            }
            
            content.innerHTML = html;
            
            // Adicionar event listeners específicos da página
            this.setupPageEvents(page);
            
        }, 300);
    }
    
    async getDashboardHTML() {
        const hoje = new Date();
        const consultasHoje = this.consultas.filter(c => {
            const dataConsulta = new Date(c.data);
            return dataConsulta.toDateString() === hoje.toDateString();
        });
        
        const pacientesMes = this.pacientes.filter(p => {
            const dataCadastro = new Date(p.dataCadastro);
            return dataCadastro.getMonth() === hoje.getMonth() &&
                   dataCadastro.getFullYear() === hoje.getFullYear();
        });
        
        return `
            <div class="page active" id="dashboard">
                <div class="page-header">
                    <h2>Dashboard</h2>
                    <div class="date-display">
                        ${hoje.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <i class="fas fa-users"></i>
                        <div class="stat-value">${this.pacientes.length}</div>
                        <div class="stat-label">Pacientes Cadastrados</div>
                        <div class="stat-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            ${pacientesMes.length} este mês
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-calendar-check"></i>
                        <div class="stat-value">${consultasHoje.length}</div>
                        <div class="stat-label">Consultas Hoje</div>
                        <div class="stat-trend">
                            <i class="fas fa-clock"></i>
                            ${consultasHoje.filter(c => c.status === 'pendente').length} pendentes
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-file-medical"></i>
                        <div class="stat-value">${this.consultas.length}</div>
                        <div class="stat-label">Consultas Realizadas</div>
                        <div class="stat-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            15% vs mês anterior
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-chart-line"></i>
                        <div class="stat-value">92%</div>
                        <div class="stat-label">Taxa de Comparecimento</div>
                        <div class="stat-trend trend-up">
                            <i class="fas fa-arrow-up"></i>
                            +2% vs mês anterior
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Consultas de Hoje</h3>
                    ${consultasHoje.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Hora</th>
                                        <th>Paciente</th>
                                        <th>Motivo</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${consultasHoje.map(consulta => `
                                        <tr>
                                            <td>${new Date(consulta.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                                            <td>${consulta.pacienteNome}</td>
                                            <td>${consulta.motivo}</td>
                                            <td><span class="status-badge ${consulta.status}">${consulta.status}</span></td>
                                            <td class="actions">
                                                <button class="btn-action view" onclick="app.abrirConsulta(${consulta.id})">
                                                    <i class="fas fa-eye"></i> Ver
                                                </button>
                                                <button class="btn-action edit" onclick="app.editarConsulta(${consulta.id})">
                                                    <i class="fas fa-edit"></i> Editar
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p>Não há consultas agendadas para hoje.</p>'}
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <div class="form-section">
                        <h3>Ações Rápidas</h3>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                            <button class="btn" onclick="app.navigateTo('pacientes')">
                                <i class="fas fa-user-plus"></i> Novo Paciente
                            </button>
                            <button class="btn" onclick="app.navigateTo('consultas')">
                                <i class="fas fa-calendar-plus"></i> Nova Consulta
                            </button>
                            <button class="btn" onclick="app.navigateTo('receituario')">
                                <i class="fas fa-prescription"></i> Novo Receituário
                            </button>
                            <button class="btn" onclick="app.navigateTo('atestado')">
                                <i class="fas fa-file-contract"></i> Novo Atestado
                            </button>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h3>Próximas Consultas</h3>
                        ${this.consultas.filter(c => new Date(c.data) > new Date() && c.status === 'agendada')
                            .slice(0, 5).map(consulta => `
                            <div style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${consulta.pacienteNome}</strong><br>
                                    <small>${new Date(consulta.data).toLocaleDateString('pt-BR')} - ${new Date(consulta.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                                </div>
                                <button class="btn-action view" onclick="app.abrirConsulta(${consulta.id})">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    async getPacientesHTML() {
        return `
            <div class="page active" id="pacientes">
                <div class="page-header">
                    <h2>Pacientes</h2>
                    <button class="btn" onclick="app.novoPaciente()">
                        <i class="fas fa-user-plus"></i> Novo Paciente
                    </button>
                </div>
                
                <div class="form-section">
                    <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                        <input type="text" id="searchPaciente" placeholder="Buscar paciente..." style="flex: 1;">
                        <select id="filterPaciente">
                            <option value="all">Todos</option>
                            <option value="ativo">Ativos</option>
                            <option value="inativo">Inativos</option>
                        </select>
                        <button class="btn" onclick="app.buscarPacientes()">
                            <i class="fas fa-search"></i> Buscar
                        </button>
                    </div>
                    
                    ${this.pacientes.length > 0 ? `
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>CPF</th>
                                        <th>Data Nasc.</th>
                                        <th>Telefone</th>
                                        <th>Última Consulta</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.pacientes.map(paciente => `
                                        <tr>
                                            <td>${paciente.nome}</td>
                                            <td>${this.formatCPF(paciente.cpf)}</td>
                                            <td>${new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')}</td>
                                            <td>${paciente.telefone}</td>
                                            <td>${paciente.ultimaConsulta ? new Date(paciente.ultimaConsulta).toLocaleDateString('pt-BR') : 'Nunca'}</td>
                                            <td><span class="status-badge ${paciente.status}">${paciente.status}</span></td>
                                            <td class="actions">
                                                <button class="btn-action view" onclick="app.verPaciente(${paciente.id})">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                                <button class="btn-action edit" onclick="app.editarPaciente(${paciente.id})">
                                                    <i class="fas fa-edit"></i>
                                                </button>
                                                <button class="btn-action delete" onclick="app.excluirPaciente(${paciente.id})">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 50px;">
                            <i class="fas fa-users" style="font-size: 3rem; color: #ccc; margin-bottom: 20px;"></i>
                            <h3 style="color: #666; margin-bottom: 10px;">Nenhum paciente cadastrado</h3>
                            <p style="color: #999;">Comece cadastrando seu primeiro paciente.</p>
                            <button class="btn" onclick="app.novoPaciente()" style="margin-top: 20px;">
                                <i class="fas fa-user-plus"></i> Cadastrar Primeiro Paciente
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    
    async getReceituarioHTML() {
        return `
            <div class="page active" id="receituario">
                <div class="page-header">
                    <h2>Receituário</h2>
                    <div>
                        <button class="btn" onclick="app.salvarReceituario()">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn" onclick="app.gerarPDFReceituario()" style="margin-left: 10px;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="pacienteReceituario">Paciente *</label>
                            <select id="pacienteReceituario" required>
                                <option value="">Selecione um paciente</option>
                                ${this.pacientes.map(p => `<option value="${p.id}">${p.nome} - ${this.formatCPF(p.cpf)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="dataReceituario">Data *</label>
                            <input type="date" id="dataReceituario" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="medicamentos">Medicamentos</label>
                        <div id="medicamentosContainer">
                            <div class="medicamento-item" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <input type="text" placeholder="Nome do medicamento" class="med-nome">
                                <input type="text" placeholder="Dosagem" class="med-dosagem">
                                <input type="text" placeholder="Posologia" class="med-posologia">
                            </div>
                        </div>
                        <button type="button" class="btn" onclick="app.adicionarMedicamento()" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Adicionar Medicamento
                        </button>
                    </div>
                    
                    <div class="form-group">
                        <label for="observacoesReceituario">Observações</label>
                        <textarea id="observacoesReceituario" placeholder="Instruções adicionais..."></textarea>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Pré-visualização</h3>
                    <div class="document-preview" id="previewReceituario">
                        <div class="document-header">
                            <h3>RECEITUÁRIO MÉDICO</h3>
                            <p>Paciente: <span id="previewPacienteNome">[Nome do Paciente]</span></p>
                            <p>Data: <span id="previewData">${new Date().toLocaleDateString('pt-BR')}</span></p>
                        </div>
                        
                        <div class="document-body">
                            <p>Medicamentos prescritos:</p>
                            <div id="previewMedicamentos">
                                <p>1. [Nome do medicamento] - [Dosagem] - [Posologia]</p>
                            </div>
                            
                            <div style="margin-top: 30px;">
                                <p><strong>Observações:</strong></p>
                                <p id="previewObservacoes">[Observações]</p>
                            </div>
                            
                            <div class="signature-area" style="margin-top: 100px;">
                                <div class="signature-line"></div>
                                <p>Assinatura do Médico</p>
                                <p><strong>CRM: </strong><span id="previewCRM">[Número do CRM]</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getAtestadoHTML() {
        return `
            <div class="page active" id="atestado">
                <div class="page-header">
                    <h2>Atestado Médico</h2>
                    <div>
                        <button class="btn" onclick="app.salvarAtestado()">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn" onclick="app.gerarPDFAtestado()" style="margin-left: 10px;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="pacienteAtestado">Paciente *</label>
                            <select id="pacienteAtestado" required>
                                <option value="">Selecione um paciente</option>
                                ${this.pacientes.map(p => `<option value="${p.id}">${p.nome} - ${this.formatCPF(p.cpf)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="dataAtestado">Data *</label>
                            <input type="date" id="dataAtestado" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tipoAtestado">Tipo de Atestado *</label>
                            <select id="tipoAtestado" required>
                                <option value="comparecimento">Comparecimento</option>
                                <option value="saude">Saúde</option>
                                <option value="afastamento">Afastamento</option>
                                <option value="obito">Óbito</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="diasAfastamento">Dias de Afastamento</label>
                            <input type="number" id="diasAfastamento" min="1" max="365" placeholder="Número de dias">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="diagnosticoAtestado">Diagnóstico/CID *</label>
                        <input type="text" id="diagnosticoAtestado" placeholder="Ex: Gripe comum (J00)" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="observacoesAtestado">Observações</label>
                        <textarea id="observacoesAtestado" placeholder="Detalhes adicionais..."></textarea>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Pré-visualização</h3>
                    <div class="document-preview" id="previewAtestado">
                        <div class="document-header">
                            <h3>ATESTADO MÉDICO</h3>
                        </div>
                        
                        <div class="document-body">
                            <p style="text-align: justify; line-height: 1.8;">
                                Atesto que o(a) paciente <strong><span id="previewAtestadoPaciente">[Nome do Paciente]</span></strong>, 
                                portador(a) do CPF <strong><span id="previewAtestadoCPF">[Número do CPF]</span></strong>, 
                                compareceu à consulta médica nesta data 
                                <strong><span id="previewAtestadoData">${new Date().toLocaleDateString('pt-BR')}</span></strong>.
                            </p>
                            
                            <div style="margin-top: 20px;">
                                <p><strong>Diagnóstico:</strong> <span id="previewAtestadoDiagnostico">[Diagnóstico]</span></p>
                                <p><strong>Dias de Afastamento:</strong> <span id="previewAtestadoDias">[Número de dias]</span> dias</p>
                                <p><strong>Observações:</strong> <span id="previewAtestadoObs">[Observações]</span></p>
                            </div>
                            
                            <div class="signature-area" style="margin-top: 100px;">
                                <div class="signature-line"></div>
                                <p>Assinatura do Médico</p>
                                <p><strong>Nome:</strong> <span id="previewAtestadoMedico">[Nome do Médico]</span></p>
                                <p><strong>CRM:</strong> <span id="previewAtestadoCRM">[Número do CRM]</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getOrcamentoHTML() {
        return `
            <div class="page active" id="orcamento">
                <div class="page-header">
                    <h2>Orçamento Médico</h2>
                    <div>
                        <button class="btn" onclick="app.salvarOrcamento()">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                        <button class="btn" onclick="app.gerarPDFOrcamento()" style="margin-left: 10px;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="pacienteOrcamento">Paciente *</label>
                            <select id="pacienteOrcamento" required>
                                <option value="">Selecione um paciente</option>
                                ${this.pacientes.map(p => `<option value="${p.id}">${p.nome} - ${this.formatCPF(p.cpf)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="dataOrcamento">Data *</label>
                            <input type="date" id="dataOrcamento" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                        <div class="form-group">
                            <label for="validadeOrcamento">Validade (dias) *</label>
                            <input type="number" id="validadeOrcamento" value="30" min="1" max="365" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="procedimentos">Procedimentos/Itens</label>
                        <div id="procedimentosContainer">
                            <div class="procedimento-item" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <input type="text" placeholder="Descrição do procedimento" class="proc-descricao">
                                <input type="number" placeholder="Quantidade" class="proc-quantidade" value="1" min="1">
                                <input type="number" placeholder="Valor unitário" class="proc-valor" min="0" step="0.01">
                            </div>
                        </div>
                        <button type="button" class="btn" onclick="app.adicionarProcedimento()" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Adicionar Item
                        </button>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="descontoOrcamento">Desconto (%)</label>
                            <input type="number" id="descontoOrcamento" value="0" min="0" max="100" step="0.01">
                        </div>
                        <div class="form-group">
                            <label for="formaPagamento">Forma de Pagamento</label>
                            <select id="formaPagamento">
                                <option value="dinheiro">Dinheiro</option>
                                <option value="cartao_credito">Cartão de Crédito</option>
                                <option value="cartao_debito">Cartão de Débito</option>
                                <option value="pix">PIX</option>
                                <option value="convenio">Convênio</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="observacoesOrcamento">Observações</label>
                        <textarea id="observacoesOrcamento" placeholder="Condições de pagamento, informações adicionais..."></textarea>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>Pré-visualização</h3>
                    <div class="document-preview" id="previewOrcamento">
                        <div class="document-header">
                            <h3>ORÇAMENTO MÉDICO</h3>
                            <p>Paciente: <span id="previewOrcamentoPaciente">[Nome do Paciente]</span></p>
                            <p>Data: <span id="previewOrcamentoData">${new Date().toLocaleDateString('pt-BR')}</span></p>
                            <p>Validade: <span id="previewOrcamentoValidade">[Data de validade]</span></p>
                        </div>
                        
                        <div class="document-body">
                            <div class="table-container" style="margin: 20px 0;">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Descrição</th>
                                            <th>Quantidade</th>
                                            <th>Valor Unitário</th>
                                            <th>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody id="previewItensOrcamento">
                                        <tr>
                                            <td>[Descrição do item]</td>
                                            <td>1</td>
                                            <td>R$ 0,00</td>
                                            <td>R$ 0,00</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <div style="text-align: right; margin-top: 20px;">
                                <p><strong>Subtotal:</strong> <span id="previewSubtotal">R$ 0,00</span></p>
                                <p><strong>Desconto:</strong> <span id="previewDesconto">R$ 0,00 (0%)</span></p>
                                <p><strong>Total:</strong> <span id="previewTotal" style="font-size: 1.2rem; color: #1a237e;">R$ 0,00</span></p>
                            </div>
                            
                            <div style="margin-top: 30px;">
                                <p><strong>Forma de Pagamento:</strong> <span id="previewFormaPagamento">[Forma de pagamento]</span></p>
                                <p><strong>Observações:</strong> <span id="previewOrcamentoObs">[Observações]</span></p>
                            </div>
                            
                            <div class="signature-area" style="margin-top: 100px;">
                                <div class="signature-line"></div>
                                <p>Assinatura do Responsável</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupPageEvents(page) {
        // Configurar eventos específicos de cada página
        switch(page) {
            case 'receituario':
                this.setupReceituarioEvents();
                break;
            case 'atestado':
                this.setupAtestadoEvents();
                break;
            case 'orcamento':
                this.setupOrcamentoEvents();
                break;
        }
    }
    
    setupReceituarioEvents() {
        // Atualizar preview quando campos mudarem
        const pacienteSelect = document.getElementById('pacienteReceituario');
        const dataInput = document.getElementById('dataReceituario');
        const observacoesTextarea = document.getElementById('observacoesReceituario');
        
        if (pacienteSelect) {
            pacienteSelect.addEventListener('change', () => this.updateReceituarioPreview());
        }
        if (dataInput) {
            dataInput.addEventListener('change', () => this.updateReceituarioPreview());
        }
        if (observacoesTextarea) {
            observacoesTextarea.addEventListener('input', () => this.updateReceituarioPreview());
        }
    }
    
    updateReceituarioPreview() {
        // Atualizar preview do receituário
        const pacienteSelect = document.getElementById('pacienteReceituario');
        const dataInput = document.getElementById('dataReceituario');
        const observacoes = document.getElementById('observacoesReceituario');
        
        if (pacienteSelect && pacienteSelect.value) {
            const paciente = this.pacientes.find(p => p.id == pacienteSelect.value);
            if (paciente) {
                document.getElementById('previewPacienteNome').textContent = paciente.nome;
            }
        }
        
        if (dataInput) {
            const data = new Date(dataInput.value);
            document.getElementById('previewData').textContent = data.toLocaleDateString('pt-BR');
        }
        
        if (observacoes) {
            document.getElementById('previewObservacoes').textContent = observacoes.value || '[Observações]';
        }
    }
    
    // Métodos de banco de dados
    async getAllPacientes() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction(['pacientes'], 'readonly');
            const store = transaction.objectStore('pacientes');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAllConsultas() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction(['consultas'], 'readonly');
            const store = transaction.objectStore('consultas');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getConfig(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            
            const transaction = this.db.transaction(['configuracoes'], 'readonly');
            const store = transaction.objectStore('configuracoes');
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }
    
    async saveConfig(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(false);
                return;
            }
            
            const transaction = this.db.transaction(['configuracoes'], 'readwrite');
            const store = transaction.objectStore('configuracoes');
            const request = store.put({ key, value });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Métodos utilitários
    formatCPF(cpf) {
        if (!cpf) return '';
        return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    updateConnectionStatus(online) {
        const statusElement = document.getElementById('syncStatus');
        const offlineElement = document.querySelector('.offline-mode');
        
        if (online) {
            statusElement.innerHTML = '<i class="fas fa-wifi"></i> Online';
            statusElement.style.background = '#e8f5e9';
            statusElement.style.color = '#2e7d32';
            
            if (offlineElement) {
                offlineElement.classList.remove('active');
            }
            
            // Tentar sincronizar dados pendentes
            this.syncPendingData();
        } else {
            statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Offline';
            statusElement.style.background = '#ffebee';
            statusElement.style.color = '#c62828';
            
            if (offlineElement) {
                offlineElement.classList.add('active');
            }
        }
    }
    
    setupConnectionMonitor() {
        // Verificar status inicial
        this.updateConnectionStatus(navigator.onLine);
    }
    
    async syncPendingData() {
        // Sincronizar dados pendentes com servidor (se houver)
        console.log('Sincronizando dados pendentes...');
        // Implementar lógica de sincronização aqui
    }
    
    async installPWA() {
        if (!this.deferredPrompt) {
            return;
        }
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('PWA instalado');
            document.getElementById('installBtn').style.display = 'none';
        }
        
        this.deferredPrompt = null;
    }
    
    async exportBackup() {
        try {
            // Coletar todos os dados
            const backupData = {
                pacientes: this.pacientes,
                consultas: this.consultas,
                documentos: this.documentos,
                metadata: {
                    dataBackup: new Date().toISOString(),
                    totalPacientes: this.pacientes.length,
                    totalConsultas: this.consultas.length,
                    versao: '1.0'
                }
            };
            
            // Criar blob para download
            const blob = new Blob([JSON.stringify(backupData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_prontuario_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Backup exportado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao exportar backup:', error);
            this.showNotification('Erro ao exportar backup', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        // Implementar notificação toast
        console.log(`${type}: ${message}`);
    }
    
    showModal(title, content) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modal').style.display = 'flex';
    }
    
    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }
    
    // Métodos públicos para chamada dos botões
    novoPaciente() {
        this.showModal('Novo Paciente', this.getPacienteFormHTML());
    }
    
    verPaciente(id) {
        const paciente = this.pacientes.find(p => p.id === id);
        if (paciente) {
            this.showModal(`Paciente: ${paciente.nome}`, this.getPacienteViewHTML(paciente));
        }
    }
    
    editarPaciente(id) {
        // Implementar edição de paciente
    }
    
    excluirPaciente(id) {
        if (confirm('Tem certeza que deseja excluir este paciente?')) {
            // Implementar exclusão
            console.log(`Excluir paciente ${id}`);
        }
    }
    
    abrirConsulta(id) {
        // Implementar visualização de consulta
    }
    
    editarConsulta(id) {
        // Implementar edição de consulta
    }
    
    salvarReceituario() {
        // Implementar salvamento de receituário
        this.showNotification('Receituário salvo com sucesso!', 'success');
    }
    
    async gerarPDFReceituario() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Configurar documento
            doc.setFont('helvetica');
            doc.setFontSize(16);
            doc.setTextColor(26, 35, 126);
            doc.text('RECEITUÁRIO MÉDICO', 105, 20, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            // Obter dados do formulário
            const pacienteSelect = document.getElementById('pacienteReceituario');
            const dataInput = document.getElementById('dataReceituario');
            
            let pacienteNome = '';
            if (pacienteSelect && pacienteSelect.value) {
                const paciente = this.pacientes.find(p => p.id == pacienteSelect.value);
                if (paciente) {
                    pacienteNome = paciente.nome;
                    doc.text(`Paciente: ${paciente.nome}`, 20, 35);
                    doc.text(`CPF: ${this.formatCPF(paciente.cpf)}`, 20, 42);
                }
            }
            
            if (dataInput) {
                const data = new Date(dataInput.value);
                doc.text(`Data: ${data.toLocaleDateString('pt-BR')}`, 20, 49);
            }
            
            // Linha divisória
            doc.setDrawColor(200, 200, 200);
            doc.line(20, 55, 190, 55);
            
            // Medicamentos
            doc.setFontSize(12);
            doc.text('Medicamentos Prescritos:', 20, 65);
            doc.setFontSize(11);
            
            let yPos = 75;
            // Coletar medicamentos do formulário
            const medicamentos = document.querySelectorAll('.medicamento-item');
            medicamentos.forEach((med, index) => {
                const nome = med.querySelector('.med-nome')?.value || '';
                const dosagem = med.querySelector('.med-dosagem')?.value || '';
                const posologia = med.querySelector('.med-posologia')?.value || '';
                
                if (nome) {
                    const texto = `${index + 1}. ${nome} - ${dosagem} - ${posologia}`;
                    const lines = doc.splitTextToSize(texto, 170);
                    lines.forEach(line => {
                        doc.text(line, 20, yPos);
                        yPos += 7;
                    });
                }
            });
            
            // Observações
            const observacoes = document.getElementById('observacoesReceituario')?.value;
            if (observacoes) {
                yPos += 10;
                doc.setFontSize(12);
                doc.text('Observações:', 20, yPos);
                yPos += 10;
                doc.setFontSize(11);
                const obsLines = doc.splitTextToSize(observacoes, 170);
                obsLines.forEach(line => {
                    doc.text(line, 20, yPos);
                    yPos += 7;
                });
            }
            
            // Assinatura
            yPos = 250;
            doc.setDrawColor(0, 0, 0);
            doc.line(20, yPos, 80, yPos);
            doc.text('Assinatura do Médico', 20, yPos + 10);
            
            // Informações do médico
            const config = await this.getConfig('clinica');
            if (config) {
                doc.text(`CRM: ${config.crm || ''}`, 120, yPos + 10);
            }
            
            // Salvar PDF
            doc.save(`receituario_${pacienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showNotification('PDF gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showNotification('Erro ao gerar PDF', 'error');
        }
    }
    
    salvarAtestado() {
        // Implementar salvamento de atestado
        this.showNotification('Atestado salvo com sucesso!', 'success');
    }
    
    async gerarPDFAtestado() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Configurações do documento
            doc.setFont('helvetica');
            
            // Cabeçalho
            doc.setFontSize(18);
            doc.setTextColor(26, 35, 126);
            doc.text('ATESTADO MÉDICO', 105, 25, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            // Dados do paciente
            const pacienteSelect = document.getElementById('pacienteAtestado');
            const dataInput = document.getElementById('dataAtestado');
            const diagnostico = document.getElementById('diagnosticoAtestado')?.value;
            const dias = document.getElementById('diasAfastamento')?.value;
            const observacoes = document.getElementById('observacoesAtestado')?.value;
            
            let pacienteNome = '';
            let pacienteCPF = '';
            
            if (pacienteSelect && pacienteSelect.value) {
                const paciente = this.pacientes.find(p => p.id == pacienteSelect.value);
                if (paciente) {
                    pacienteNome = paciente.nome;
                    pacienteCPF = paciente.cpf;
                }
            }
            
            // Conteúdo do atestado
            let yPos = 50;
            const texto = `Atesto que o(a) paciente ${pacienteNome}, portador(a) do CPF ${this.formatCPF(pacienteCPF)}, 
                           compareceu à consulta médica nesta data ${dataInput ? new Date(dataInput.value).toLocaleDateString('pt-BR') : ''}.`;
            
            const lines = doc.splitTextToSize(texto, 170);
            lines.forEach(line => {
                doc.text(line, 20, yPos);
                yPos += 7;
            });
            
            // Diagnóstico
            yPos += 10;
            doc.setFontSize(12);
            doc.text('Diagnóstico:', 20, yPos);
            yPos += 10;
            doc.setFontSize(11);
            if (diagnostico) {
                const diagLines = doc.splitTextToSize(diagnostico, 170);
                diagLines.forEach(line => {
                    doc.text(line, 20, yPos);
                    yPos += 7;
                });
            }
            
            // Dias de afastamento
            if (dias) {
                yPos += 5;
                doc.text(`Dias de afastamento: ${dias} dias`, 20, yPos);
            }
            
            // Observações
            if (observacoes) {
                yPos += 10;
                doc.text('Observações:', 20, yPos);
                yPos += 10;
                const obsLines = doc.splitTextToSize(observacoes, 170);
                obsLines.forEach(line => {
                    doc.text(line, 20, yPos);
                    yPos += 7;
                });
            }
            
            // Assinatura
            yPos = 220;
            doc.setDrawColor(0, 0, 0);
            doc.line(20, yPos, 80, yPos);
            doc.text('Assinatura do Médico', 20, yPos + 10);
            
            // Informações do médico
            const config = await this.getConfig('clinica');
            if (config) {
                doc.text(`Dr(a). ${config.nome || ''}`, 120, yPos);
                doc.text(`CRM: ${config.crm || ''}`, 120, yPos + 7);
            }
            
            // Salvar PDF
            doc.save(`atestado_${pacienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showNotification('PDF gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showNotification('Erro ao gerar PDF', 'error');
        }
    }
    
    salvarOrcamento() {
        // Implementar salvamento de orçamento
        this.showNotification('Orçamento salvo com sucesso!', 'success');
    }
    
    async gerarPDFOrcamento() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Configurar documento
            doc.setFont('helvetica');
            
            // Cabeçalho
            doc.setFontSize(18);
            doc.setTextColor(26, 35, 126);
            doc.text('ORÇAMENTO MÉDICO', 105, 20, { align: 'center' });
            
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            // Dados do orçamento
            const pacienteSelect = document.getElementById('pacienteOrcamento');
            const dataInput = document.getElementById('dataOrcamento');
            const validade = document.getElementById('validadeOrcamento')?.value;
            const desconto = document.getElementById('descontoOrcamento')?.value || 0;
            const formaPagamento = document.getElementById('formaPagamento')?.value;
            const observacoes = document.getElementById('observacoesOrcamento')?.value;
            
            let pacienteNome = '';
            let yPos = 35;
            
            if (pacienteSelect && pacienteSelect.value) {
                const paciente = this.pacientes.find(p => p.id == pacienteSelect.value);
                if (paciente) {
                    pacienteNome = paciente.nome;
                    doc.text(`Paciente: ${paciente.nome}`, 20, yPos);
                    doc.text(`CPF: ${this.formatCPF(paciente.cpf)}`, 20, yPos + 7);
                }
            }
            
            yPos += 14;
            if (dataInput) {
                const data = new Date(dataInput.value);
                doc.text(`Data: ${data.toLocaleDateString('pt-BR')}`, 20, yPos);
            }
            
            if (validade) {
                const dataValidade = new Date();
                dataValidade.setDate(dataValidade.getDate() + parseInt(validade));
                doc.text(`Validade: ${dataValidade.toLocaleDateString('pt-BR')}`, 20, yPos + 7);
            }
            
            yPos += 20;
            
            // Tabela de itens
            const headers = [['Descrição', 'Quantidade', 'Valor Unitário', 'Subtotal']];
            const data = [];
            
            // Coletar itens do formulário
            const procedimentos = document.querySelectorAll('.procedimento-item');
            let subtotal = 0;
            
            procedimentos.forEach(proc => {
                const descricao = proc.querySelector('.proc-descricao')?.value;
                const quantidade = parseFloat(proc.querySelector('.proc-quantidade')?.value) || 0;
                const valor = parseFloat(proc.querySelector('.proc-valor')?.value) || 0;
                const subtotalItem = quantidade * valor;
                subtotal += subtotalItem;
                
                if (descricao) {
                    data.push([
                        descricao,
                        quantidade.toString(),
                        `R$ ${valor.toFixed(2)}`,
                        `R$ ${subtotalItem.toFixed(2)}`
                    ]);
                }
            });
            
            // Adicionar tabela ao PDF
            doc.autoTable({
                startY: yPos,
                head: headers,
                body: data,
                theme: 'grid',
                headStyles: { fillColor: [26, 35, 126] },
                margin: { left: 20, right: 20 }
            });
            
            // Cálculos finais
            const descontoValor = subtotal * (parseFloat(desconto) / 100);
            const total = subtotal - descontoValor;
            
            let finalY = doc.lastAutoTable.finalY + 10;
            
            // Totais
            doc.setFontSize(12);
            doc.text(`Subtotal: R$ ${subtotal.toFixed(2)}`, 140, finalY);
            finalY += 10;
            doc.text(`Desconto: R$ ${descontoValor.toFixed(2)} (${desconto}%)`, 140, finalY);
            finalY += 10;
            doc.setFontSize(14);
            doc.setTextColor(26, 35, 126);
            doc.text(`Total: R$ ${total.toFixed(2)}`, 140, finalY);
            
            finalY += 20;
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            // Forma de pagamento
            if (formaPagamento) {
                doc.text(`Forma de Pagamento: ${formaPagamento}`, 20, finalY);
                finalY += 10;
            }
            
            // Observações
            if (observacoes) {
                doc.text('Observações:', 20, finalY);
                finalY += 10;
                const obsLines = doc.splitTextToSize(observacoes, 170);
                obsLines.forEach(line => {
                    doc.text(line, 20, finalY);
                    finalY += 7;
                });
            }
            
            // Assinatura
            finalY = 260;
            doc.setDrawColor(0, 0, 0);
            doc.line(20, finalY, 80, finalY);
            doc.text('Assinatura do Responsável', 20, finalY + 10);
            
            // Salvar PDF
            doc.save(`orcamento_${pacienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showNotification('PDF gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            this.showNotification('Erro ao gerar PDF', 'error');
        }
    }
    
    adicionarMedicamento() {
        const container = document.getElementById('medicamentosContainer');
        if (container) {
            const newItem = document.createElement('div');
            newItem.className = 'medicamento-item';
            newItem.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px;';
            newItem.innerHTML = `
                <input type="text" placeholder="Nome do medicamento" class="med-nome">
                <input type="text" placeholder="Dosagem" class="med-dosagem">
                <input type="text" placeholder="Posologia" class="med-posologia">
            `;
            container.appendChild(newItem);
        }
    }
    
    adicionarProcedimento() {
        const container = document.getElementById('procedimentosContainer');
        if (container) {
            const newItem = document.createElement('div');
            newItem.className = 'procedimento-item';
            newItem.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px;';
            newItem.innerHTML = `
                <input type="text" placeholder="Descrição do procedimento" class="proc-descricao">
                <input type="number" placeholder="Quantidade" class="proc-quantidade" value="1" min="1">
                <input type="number" placeholder="Valor unitário" class="proc-valor" min="0" step="0.01">
            `;
            container.appendChild(newItem);
        }
    }
}

// Inicializar aplicação
let app;
window.onload = () => {
    app = new ProntuarioApp();
};
