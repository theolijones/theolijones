import React, { useState, useEffect, useCallback } from 'react';
import { getMailingList, addRecipient, updateRecipient, deleteRecipient } from '../api/mailingList';

export default function MailingListPage() {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRecipients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMailingList();
      setRecipients(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load mailing list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await addRecipient(formData);
      setShowModal(false);
      setFormData({ name: '', email: '' });
      fetchRecipients();
    } catch (err) {
      setFormError(err.message || 'Failed to add recipient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (recipient) => {
    try {
      await updateRecipient(recipient.id, { active: !recipient.active });
      setRecipients((prev) =>
        prev.map((r) => (r.id === recipient.id ? { ...r, active: !r.active } : r))
      );
    } catch (err) {
      setError(err.message || 'Failed to update recipient');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRecipient(id);
      setConfirmDelete(null);
      fetchRecipients();
    } catch (err) {
      setError(err.message || 'Failed to delete recipient');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error && recipients.length === 0) {
    return (
      <div className="bg-slate-800 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400 font-heading">{error}</p>
        <button
          onClick={fetchRecipients}
          className="mt-3 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-heading font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-slate-100">Mailing List</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-heading font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          Add Recipient
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm font-heading bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {recipients.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-400 font-heading">No recipients in mailing list.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-heading text-xs uppercase">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-center">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-slate-400">{r.email}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(r)}
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-heading font-semibold uppercase transition-colors ${
                          r.active !== false
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-slate-600/30 text-slate-500 hover:bg-slate-600/50'
                        }`}
                      >
                        {r.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDelete === r.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-slate-400">Confirm?</span>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="px-2 py-1 bg-red-500 text-white rounded text-xs font-heading font-semibold hover:bg-red-400 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 bg-slate-600 text-slate-200 rounded text-xs font-heading hover:bg-slate-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(r.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-heading font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Recipient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="font-heading text-lg font-bold text-slate-100 mb-4">Add Recipient</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-heading text-slate-400 uppercase tracking-wider mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Recipient name"
                />
              </div>
              <div>
                <label className="block text-xs font-heading text-slate-400 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="email@company.com"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-400 font-heading">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg font-heading text-sm hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-heading font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding...' : 'Add Recipient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
