import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import {
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getAccounts,
  createAccount,
  deleteAccount,
  toggleAccount,
} from '../api/companies';

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x'];

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500 text-white',
  facebook: 'bg-blue-500 text-white',
  tiktok: 'bg-cyan-400 text-slate-900',
  x: 'bg-gray-400 text-slate-900',
};

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, type, onDismiss }) {
  if (!message) return null;
  const colors = type === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';
  return (
    <div className={`mb-4 px-4 py-3 border rounded-lg text-sm font-heading flex items-center justify-between ${colors}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-3 hover:opacity-70 transition-opacity">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function CompaniesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [accounts, setAccounts] = useState({});

  // Modals
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(null);

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: '', logo_url: '', notes: '' });
  const [accountForm, setAccountForm] = useState({ platform: 'instagram', handle: '', account_url: '' });

  // Feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearFeedback = () => { setError(''); setSuccess(''); };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await getCompanies();
      setCompanies(Array.isArray(data) ? data : data?.data || []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const fetchAccounts = useCallback(async (companyId) => {
    try {
      const data = await getAccounts(companyId);
      setAccounts((prev) => ({ ...prev, [companyId]: Array.isArray(data) ? data : data?.data || [] }));
    } catch {
      setAccounts((prev) => ({ ...prev, [companyId]: [] }));
    }
  }, []);

  const handleToggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!accounts[id]) fetchAccounts(id);
      }
      return next;
    });
  };

  // ---- Company CRUD ----

  const handleAddCompany = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createCompany(companyForm);
      setShowAddCompany(false);
      setCompanyForm({ name: '', logo_url: '', notes: '' });
      showSuccess('Company created successfully');
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to create company');
    }
  };

  const openEditCompany = (company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name || '',
      logo_url: company.logo_url || '',
      notes: company.notes || '',
    });
    setError('');
  };

  const handleEditCompany = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await updateCompany(editingCompany.id, companyForm);
      setEditingCompany(null);
      setCompanyForm({ name: '', logo_url: '', notes: '' });
      showSuccess('Company updated successfully');
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to update company');
    }
  };

  const handleDeactivateCompany = async (company) => {
    const nextActive = company.active === false;
    try {
      await updateCompany(company.id, { active: nextActive });
      showSuccess(`Company ${nextActive ? 'activated' : 'deactivated'} successfully`);
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to update company status');
    }
  };

  // ---- Account CRUD ----

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setError('');
    const companyId = showAddAccount;
    try {
      await createAccount(companyId, accountForm);
      setShowAddAccount(null);
      setAccountForm({ platform: 'instagram', handle: '', account_url: '' });
      showSuccess('Account added successfully');
      fetchAccounts(companyId);
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to add account');
    }
  };

  const handleToggleAccount = async (companyId, accountId, currentlyActive) => {
    try {
      await toggleAccount(accountId, !currentlyActive);
      fetchAccounts(companyId);
    } catch (err) {
      setError(err.message || 'Failed to toggle account');
    }
  };

  const handleDeleteAccount = async (companyId, accountId) => {
    if (!window.confirm('Delete this account?')) return;
    try {
      await deleteAccount(accountId);
      showSuccess('Account deleted');
      fetchAccounts(companyId);
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to delete account');
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-slate-100">Companies</h1>
        {isAdmin && (
          <button
            onClick={() => { setShowAddCompany(true); setCompanyForm({ name: '', logo_url: '', notes: '' }); setError(''); }}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
          >
            + Add Company
          </button>
        )}
      </div>

      {/* Feedback */}
      <Toast message={success} type="success" onDismiss={() => setSuccess('')} />
      <Toast message={error} type="error" onDismiss={() => setError('')} />

      {/* Companies Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 font-heading text-xs uppercase">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-center">Accounts</th>
              <th className="px-4 py-3 text-center">Status</th>
              {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <React.Fragment key={company.id}>
                {/* Company Row */}
                <tr
                  onClick={() => handleToggleExpand(company.id)}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-4 h-4 text-slate-500 transition-transform ${expandedIds.has(company.id) ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <div className="flex items-center gap-2">
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                            {(company.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-slate-200 font-medium">{company.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 font-heading">
                    {company.account_count ?? company.accounts_count ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-heading ${
                      company.active !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-600/30 text-slate-500'
                    }`}>
                      {company.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditCompany(company); }}
                          className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeactivateCompany(company); }}
                          className={`text-xs font-medium transition-colors ${
                            company.active !== false
                              ? 'text-slate-400 hover:text-slate-300'
                              : 'text-emerald-500 hover:text-emerald-400'
                          }`}
                        >
                          {company.active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>

                {/* Expanded Accounts */}
                {expandedIds.has(company.id) && (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="bg-slate-900/50">
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-heading text-xs text-slate-400 uppercase tracking-wider">
                            Social Accounts
                          </h4>
                          {isAdmin && (
                            <button
                              onClick={() => { setShowAddAccount(company.id); setAccountForm({ platform: 'instagram', handle: '', account_url: '' }); setError(''); }}
                              className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors"
                            >
                              + Add Account
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {(accounts[company.id] || []).length === 0 && (
                            <p className="text-sm text-slate-500 py-2">No accounts configured</p>
                          )}
                          {(accounts[company.id] || []).map((acc) => (
                            <div key={acc.id} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700/50">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold uppercase ${PLATFORM_COLORS[acc.platform?.toLowerCase()] || 'bg-slate-500 text-white'}`}>
                                {acc.platform}
                              </span>
                              <span className="text-sm text-slate-200 font-medium">@{acc.handle}</span>
                              {(acc.account_url || acc.url) && (
                                <a
                                  href={acc.account_url || acc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-slate-500 hover:text-slate-300 truncate max-w-[200px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {acc.account_url || acc.url}
                                </a>
                              )}
                              <div className="ml-auto flex items-center gap-3">
                                {isAdmin && (
                                  <button
                                    onClick={() => handleToggleAccount(company.id, acc.id, acc.is_active !== false)}
                                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                                    style={{ backgroundColor: acc.is_active !== false ? '#10b981' : '#475569' }}
                                    title={acc.is_active !== false ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                        acc.is_active !== false ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                      }`}
                                    />
                                  </button>
                                )}
                                {!isAdmin && (
                                  <span className={`text-xs font-heading ${acc.is_active !== false ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {acc.is_active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteAccount(company.id, acc.id)}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-slate-500">
                  No companies yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Company Modal */}
      <Modal open={showAddCompany} onClose={() => { setShowAddCompany(false); clearFeedback(); }} title="Add Company">
        {error && <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleAddCompany} className="space-y-4">
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Name *</label>
            <input
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="Company name"
            />
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Logo URL</label>
            <input
              value={companyForm.logo_url}
              onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Notes</label>
            <textarea
              value={companyForm.notes}
              onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
          >
            Create Company
          </button>
        </form>
      </Modal>

      {/* Edit Company Modal */}
      <Modal open={!!editingCompany} onClose={() => { setEditingCompany(null); clearFeedback(); }} title="Edit Company">
        {error && <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleEditCompany} className="space-y-4">
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Name *</label>
            <input
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="Company name"
            />
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Logo URL</label>
            <input
              value={companyForm.logo_url}
              onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Notes</label>
            <textarea
              value={companyForm.notes}
              onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              placeholder="Optional notes..."
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </form>
      </Modal>

      {/* Add Account Modal */}
      <Modal open={!!showAddAccount} onClose={() => { setShowAddAccount(null); clearFeedback(); }} title="Add Account">
        {error && <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Platform</label>
            <select
              value={accountForm.platform}
              onChange={(e) => setAccountForm({ ...accountForm, platform: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Handle</label>
            <input
              value={accountForm.handle}
              onChange={(e) => setAccountForm({ ...accountForm, handle: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="@handle"
            />
          </div>
          <div>
            <label className="block text-xs font-heading text-slate-400 mb-1 uppercase tracking-wider">Account URL</label>
            <input
              value={accountForm.account_url}
              onChange={(e) => setAccountForm({ ...accountForm, account_url: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="https://instagram.com/handle"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
          >
            Add Account
          </button>
        </form>
      </Modal>
    </div>
  );
}
