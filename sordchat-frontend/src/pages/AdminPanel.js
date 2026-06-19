import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Link2,
  ListChecks,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const tabs = [
  ['dashboard', 'Dashboard Geral', ShieldCheck],
  ['companies', 'Empresas', Building2],
  ['users', 'Usuarios', Users],
  ['mindmap', 'Mapa Mental', GitBranch],
  ['imports', 'Importacao por Planilha', FileSpreadsheet],
  ['links', 'Vinculos', Link2],
  ['logs', 'Logs/Auditoria', ListChecks],
  ['settings', 'Configuracoes', Settings],
];

const initialCompanyForm = {
  name: '',
  cnpj: '',
  responsible_name: '',
  phone_primary: '',
  phone_secondary: '',
  status: 'active',
};

const initialUserForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  company_id: '',
  department: '',
  role: 'user',
  status: 'active',
};

const roleLabel = {
  master_admin: 'Admin Master',
  company_admin: 'Admin Empresa',
  coordinator: 'Coordenador',
  user: 'Usuario',
};

const statusLabel = {
  active: 'Ativo',
  inactive: 'Inativo',
};

const importTemplateColumns = {
  companies: ['nome_empresa', 'cnpj', 'responsavel', 'telefone_1', 'telefone_2', 'status'],
  users: ['nome_usuario', 'email', 'senha_primaria', 'id_empresa', 'telefone', 'setor', 'nivel_usuario', 'status'],
};

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvEscape).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Operacao nao concluida.');
  }

  return response.json();
};

const uploadImportPreview = async (kind, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/platform/import/${kind}/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Nao foi possivel ler a planilha.');
  }

  return response.json();
};

const Metric = ({ icon: Icon, label, value }) => (
  <article className="metric-card">
    <Icon className="text-teal-700" size={20} />
    <p className="m-0 mt-4 text-sm font-bold text-slate-500">{label}</p>
    <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{value || 0}</p>
  </article>
);

const MindNode = ({ node, onSelect }) => (
  <div className="mind-node-branch">
    <button className={`mind-node mind-node--${node.type}`} type="button" onClick={() => onSelect(node)}>
      <span className="mind-node__type">{node.type}</span>
      <strong>{node.label}</strong>
      {node.role && <small>{roleLabel[node.role] || node.role}</small>}
      {node.status && <small>{statusLabel[node.status] || node.status}</small>}
    </button>
    {node.children?.length > 0 && (
      <div className="mind-node-children">
        {node.children.map((child) => (
          <MindNode key={`${child.type}-${child.id}-${child.link_id || ''}`} node={child} onSelect={onSelect} />
        ))}
      </div>
    )}
  </div>
);

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [importKind, setImportKind] = useState('companies');
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await requestJson('/platform/overview');
      setOverview(data);
      const firstCompanyId = data.companies?.[0]?.id || '';
      setUserForm((prev) => ({ ...prev, company_id: prev.company_id || firstCompanyId }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const companies = useMemo(() => overview?.companies || [], [overview]);
  const users = useMemo(() => overview?.users || [], [overview]);
  const links = useMemo(() => overview?.company_users || [], [overview]);
  const departments = useMemo(() => overview?.departments || [], [overview]);
  const logs = useMemo(() => overview?.audit_logs || [], [overview]);
  const stats = overview?.stats || {};

  const departmentsForUserCompany = useMemo(
    () => departments.filter((department) => department.company_id === userForm.company_id),
    [departments, userForm.company_id]
  );

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.full_name, user.email, user.phone, user.company_name, user.company_role]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [query, users]);

  const handleCreateCompany = async (event) => {
    event.preventDefault();
    try {
      await requestJson('/platform/companies', {
        method: 'POST',
        body: JSON.stringify(companyForm),
      });
      toast.success('Empresa criada.');
      setCompanyForm(initialCompanyForm);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    try {
      await requestJson('/platform/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      toast.success('Usuario criado e vinculado.');
      setUserForm((prev) => ({
        ...initialUserForm,
        company_id: prev.company_id,
        department: prev.department,
      }));
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      toast.error('Selecione uma planilha CSV ou XLSX.');
      return;
    }
    try {
      const preview = await uploadImportPreview(importKind, importFile);
      setImportPreview(preview);
      toast.success('Previa gerada.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDownloadImportTemplate = () => {
    const companyIdExample = companies[0]?.id || 'COLE_AQUI_O_ID_DA_EMPRESA';
    const rowsByKind = {
      companies: [
        importTemplateColumns.companies,
        ['Empresa Exemplo Ltda', '12345678000190', 'Maria Responsavel', '11999990000', '1133334444', 'active'],
      ],
      users: [
        importTemplateColumns.users,
        ['Joao Usuario', 'joao.usuario@empresa.com', 'Senha@123', companyIdExample, '11988887777', 'Atendimento', 'user', 'active'],
      ],
    };
    const filename = importKind === 'companies' ? 'modelo-importacao-empresas.csv' : 'modelo-importacao-usuarios.csv';
    downloadCsv(filename, rowsByKind[importKind]);
    toast.success('Modelo de planilha baixado.');
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.rows?.length) {
      toast.error('Gere a previa antes de confirmar.');
      return;
    }
    try {
      const result = await requestJson(`/platform/import/${importKind}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ rows: importPreview.rows.map((row) => row.data) }),
      });
      toast.success(`Importacao concluida. Registros: ${result.imported || result.linked || 0}`);
      setImportPreview(null);
      setImportFile(null);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleResetPassword = async (userId) => {
    const password = window.prompt('Informe a nova senha primaria para este usuario:');
    if (!password) return;
    try {
      await requestJson(`/platform/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      toast.success('Senha resetada. Usuario devera trocar no proximo login.');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleUpdateLink = async (linkId, payload) => {
    try {
      await requestJson(`/platform/company-users/${linkId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success('Vinculo atualizado.');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRemoveLink = async (linkId) => {
    if (!window.confirm('Remover este vinculo?')) return;
    try {
      await requestJson(`/platform/company-users/${linkId}`, { method: 'DELETE' });
      toast.success('Vinculo removido.');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const renderDashboard = () => (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Building2} label="Empresas" value={stats.companies} />
        <Metric icon={CheckCircle2} label="Empresas ativas" value={stats.active_companies} />
        <Metric icon={Users} label="Usuarios" value={stats.users} />
        <Metric icon={Link2} label="Vinculos ativos" value={stats.links} />
        <Metric icon={GitBranch} label="Setores" value={stats.departments} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="panel p-5">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Empresas recentes</h3>
          <div className="mt-4 grid gap-3">
            {companies.slice(0, 6).map((company) => (
              <button className="tenant-row" key={company.id} type="button" onClick={() => setSelectedNode({ ...company, type: 'company', label: company.name })}>
                <span>
                  <strong>{company.name}</strong>
                  <small>{company.cnpj || 'Sem CNPJ'} - {company.responsible_name || 'Sem responsavel'}</small>
                </span>
                <span className="badge">{statusLabel[company.status] || company.status}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="panel p-5">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Auditoria recente</h3>
          <div className="mt-4 grid gap-3">
            {logs.slice(0, 7).map((log) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={log.id}>
                <p className="m-0 text-sm font-extrabold text-slate-950">{log.action}</p>
                <p className="m-0 mt-1 text-xs text-slate-500">{log.entity_type} #{log.entity_id}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );

  const renderCompanies = () => (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <article className="panel p-5">
        <h3 className="m-0 text-lg font-extrabold text-slate-950">Cadastro manual de empresa</h3>
        <form className="mt-4 grid gap-3" onSubmit={handleCreateCompany}>
          <input className="input" value={companyForm.name} onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome da empresa" />
          <input className="input" value={companyForm.cnpj} onChange={(event) => setCompanyForm((prev) => ({ ...prev, cnpj: event.target.value }))} placeholder="CNPJ" />
          <input className="input" value={companyForm.responsible_name} onChange={(event) => setCompanyForm((prev) => ({ ...prev, responsible_name: event.target.value }))} placeholder="Responsavel" />
          <input className="input" value={companyForm.phone_primary} onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone_primary: event.target.value }))} placeholder="Telefone 1" />
          <input className="input" value={companyForm.phone_secondary} onChange={(event) => setCompanyForm((prev) => ({ ...prev, phone_secondary: event.target.value }))} placeholder="Telefone 2" />
          <select className="select" value={companyForm.status} onChange={(event) => setCompanyForm((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </select>
          <button className="button-primary" type="submit">
            <Save size={17} />
            Criar empresa
          </button>
        </form>
      </article>

      <article className="panel p-5">
        <h3 className="m-0 text-lg font-extrabold text-slate-950">Empresas</h3>
        <div className="mt-4 grid gap-3">
          {companies.map((company) => (
            <button className="tenant-row" key={company.id} type="button" onClick={() => setSelectedNode({ ...company, type: 'company', label: company.name })}>
              <span>
                <strong>{company.name}</strong>
                <small>{company.id}</small>
              </span>
              <span className="badge">{statusLabel[company.status] || company.status}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );

  const renderUsers = () => (
    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <article className="panel p-5">
        <h3 className="m-0 text-lg font-extrabold text-slate-950">Cadastro manual de usuario</h3>
        <form className="mt-4 grid gap-3" onSubmit={handleCreateUser}>
          <input className="input" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nome" />
          <input className="input" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" />
          <input className="input" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Senha primaria" />
          <input className="input" value={userForm.phone} onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Telefone" />
          <select className="select" value={userForm.company_id} onChange={(event) => setUserForm((prev) => ({ ...prev, company_id: event.target.value, department: '' }))}>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <input className="input" list="departments-list" value={userForm.department} onChange={(event) => setUserForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Setor" />
          <datalist id="departments-list">
            {departmentsForUserCompany.map((department) => (
              <option key={department.id} value={department.name} />
            ))}
          </datalist>
          <select className="select" value={userForm.role} onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}>
            <option value="company_admin">Company admin</option>
            <option value="coordinator">Coordinator</option>
            <option value="user">User</option>
          </select>
          <select className="select" value={userForm.status} onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
          <button className="button-primary" type="submit">
            <UserPlus size={17} />
            Criar usuario
          </button>
        </form>
      </article>

      <article className="panel p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Usuarios</h3>
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" />
          </div>
        </div>
        <div className="grid gap-3">
          {filteredUsers.map((user) => (
            <div className="tenant-row" key={user.id}>
              <span>
                <strong>{user.full_name || user.name}</strong>
                <small>{user.email} - {user.company_name || 'Sem empresa principal'}</small>
              </span>
              <button className="button-secondary" type="button" onClick={() => handleResetPassword(user.id)}>
                <KeyRound size={15} />
                Resetar
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );

  const renderMindMap = () => (
    <section className="grid gap-4 xl:grid-cols-[1fr_330px]">
      <article className="panel p-5 overflow-x-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Admin Master &gt; Empresas &gt; Setores &gt; Usuarios</h3>
          <button className="button-secondary" type="button" onClick={() => setActiveTab('companies')}>
            <Building2 size={16} />
            Criar empresa
          </button>
        </div>
        {overview?.mind_map && <MindNode node={overview.mind_map} onSelect={setSelectedNode} />}
      </article>

      <aside className="panel p-5">
        <h3 className="m-0 text-lg font-extrabold text-slate-950">Detalhes</h3>
        {selectedNode ? (
          <div className="mt-4 grid gap-3">
            <span className="badge">{selectedNode.type}</span>
            <p className="m-0 text-xl font-extrabold text-slate-950">{selectedNode.label || selectedNode.name}</p>
            <p className="m-0 break-all text-sm text-slate-500">{selectedNode.id}</p>
            {selectedNode.email && <p className="m-0 text-sm text-slate-500">{selectedNode.email}</p>}
            {selectedNode.role && <span className="badge">{roleLabel[selectedNode.role] || selectedNode.role}</span>}
            <div className="grid gap-2">
              <button className="button-secondary" type="button" onClick={() => setActiveTab('users')}>Criar usuario</button>
              <button className="button-secondary" type="button" onClick={() => setActiveTab('imports')}>Importar planilha</button>
              {selectedNode.type === 'user' && (
                <button className="button-secondary" type="button" onClick={() => handleResetPassword(Number(selectedNode.id))}>
                  Resetar senha
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Clique em uma empresa, setor ou usuario para abrir detalhes e acoes rapidas.</p>
        )}
      </aside>
    </section>
  );

  const renderImports = () => (
    <section className="panel p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Importacao por planilha</h3>
          <p className="m-0 mt-1 text-sm text-slate-500">Gere a previa, corrija erros e confirme a importacao.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="select" value={importKind} onChange={(event) => { setImportKind(event.target.value); setImportPreview(null); }}>
            <option value="companies">Empresas</option>
            <option value="users">Usuarios</option>
          </select>
          <button className="button-secondary" type="button" onClick={handleDownloadImportTemplate}>
            <Download size={16} />
            Baixar modelo
          </button>
          <input className="input" type="file" accept=".csv,.tsv,.txt,.xlsx" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
          <button className="button-secondary" type="button" onClick={handlePreviewImport}>
            <Upload size={16} />
            Previa
          </button>
          <button className="button-primary" type="button" onClick={handleConfirmImport} disabled={!importPreview || importPreview.error_count > 0}>
            Confirmar
          </button>
        </div>
      </div>

      {importPreview && (
        <div className="mt-5 overflow-x-auto">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="badge">Validos: {importPreview.valid_count}</span>
            <span className="badge badge--danger">Erros: {importPreview.error_count}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Linha</th>
                <th>Dados</th>
                <th>Status</th>
                <th>Erros/Avisos</th>
              </tr>
            </thead>
            <tbody>
              {importPreview.rows.map((row) => (
                <tr key={row.row}>
                  <td>{row.row}</td>
                  <td><code>{JSON.stringify(row.data)}</code></td>
                  <td>{row.valid ? <CheckCircle2 className="text-emerald-600" size={18} /> : <XCircle className="text-red-600" size={18} />}</td>
                  <td>{[...(row.errors || []), ...(row.warnings || [])].join(' | ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const renderLinks = () => (
    <section className="panel p-5">
      <h3 className="m-0 text-lg font-extrabold text-slate-950">Vinculos usuario-empresa</h3>
      <div className="mt-4 grid gap-3">
        {links.map((link) => (
          <div className="tenant-row" key={link.id}>
            <span>
              <strong>{link.user_name}</strong>
              <small>{link.company_name} - {link.department_name || 'Sem setor'} - {roleLabel[link.role] || link.role}</small>
            </span>
            <div className="flex flex-wrap gap-2">
              <select className="select" value={link.role} onChange={(event) => handleUpdateLink(link.id, { role: event.target.value })}>
                <option value="company_admin">Company admin</option>
                <option value="coordinator">Coordinator</option>
                <option value="user">User</option>
              </select>
              <button className="button-secondary" type="button" onClick={() => handleRemoveLink(link.id)}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const renderLogs = () => (
    <section className="panel p-5">
      <h3 className="m-0 text-lg font-extrabold text-slate-950">Logs e auditoria</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Acao</th>
              <th>Entidade</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>{log.action}</td>
                <td>{log.entity_type} #{log.entity_id}</td>
                <td><code>{JSON.stringify(log.metadata || {})}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderSettings = () => (
    <section className="panel p-5">
      <h3 className="m-0 text-lg font-extrabold text-slate-950">Configuracoes</h3>
      <p className="m-0 mt-2 text-sm text-slate-500">
        Empresas inativas ficam bloqueadas para vinculos e operacao. Usuarios importados entram com troca de senha obrigatoria.
      </p>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <span>Roles: master_admin, company_admin, coordinator, user.</span>
        <span>Colunas de empresas: nome_empresa, cnpj, responsavel, telefone_1, telefone_2, status.</span>
        <span>Colunas de usuarios: nome_usuario, email, senha_primaria, id_empresa, telefone, setor, nivel_usuario, status.</span>
      </div>
    </section>
  );

  const renderContent = () => {
    if (loading) {
      return <div className="panel p-6 text-sm font-bold text-slate-500">Carregando Admin Master...</div>;
    }
    if (activeTab === 'dashboard') return renderDashboard();
    if (activeTab === 'companies') return renderCompanies();
    if (activeTab === 'users') return renderUsers();
    if (activeTab === 'mindmap') return renderMindMap();
    if (activeTab === 'imports') return renderImports();
    if (activeTab === 'links') return renderLinks();
    if (activeTab === 'logs') return renderLogs();
    return renderSettings();
  };

  return (
    <div className="work-page">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="badge">
              <ShieldCheck size={13} />
              Admin Master
            </span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Arquitetura multi-tenant</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Controle empresas, usuarios, setores, vinculos, importacoes e auditoria com isolamento por company_id.
            </p>
          </div>
          <button className="button-secondary" type="button" onClick={loadData} disabled={loading}>
            <RefreshCw size={17} />
            Atualizar
          </button>
        </div>
      </section>

      <section className="tenant-tabs" aria-label="Abas Admin Master">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={activeTab === id ? 'active' : ''} type="button" onClick={() => setActiveTab(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </section>

      {renderContent()}
    </div>
  );
};

export default AdminPanel;
