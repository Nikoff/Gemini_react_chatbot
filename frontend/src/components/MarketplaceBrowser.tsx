import { useState, useEffect } from 'react';
import { Store, Search, Star, Download, ShoppingCart, X, Plus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  category: string | null;
  price: number;
  downloads: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  user: { id: string; email: string };
  createdAt: string;
  purchaseCount?: number;
  reviewCount?: number;
}

interface Props {
  session: any;
  isOpen: boolean;
  onClose: () => void;
}

const TYPES = [
  { value: '', label: 'All Types' },
  { value: 'workflow', label: 'Workflows' },
  { value: 'agent_template', label: 'Agent Templates' },
  { value: 'style_preset', label: 'Style Presets' },
  { value: 'automation_template', label: 'Automation Templates' },
];

const SORTS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

export function MarketplaceBrowser({ session, isOpen, onClose }: Props) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({ name: '', description: '', type: 'workflow', price: 0, tags: '' });

  useEffect(() => {
    if (isOpen) loadItems();
  }, [isOpen, typeFilter, sortBy]);

  const loadItems = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      params.set('sort', sortBy);
      if (search) params.set('q', search);

      const res = await fetch(`${API_URL}/api/marketplace?${params}`);
      if (res.ok) setItems(await res.json());
    } catch {}
  };

  const handleSearch = () => loadItems();

  const handlePurchase = async (item: MarketplaceItem) => {
    setIsPurchasing(true);
    try {
      const res = await fetch(`${API_URL}/api/marketplace/${item.id}/purchase`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setSelectedItem(null);
        loadItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Purchase failed');
      }
    } catch {
      alert('Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handlePublish = async () => {
    if (!publishForm.name.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/marketplace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: publishForm.name.trim(),
          description: publishForm.description.trim() || null,
          type: publishForm.type,
          price: publishForm.price,
          content: { placeholder: true },
          tags: publishForm.tags ? publishForm.tags.split(',').map(t => t.trim()) : [],
        }),
      });

      if (res.ok) {
        setShowPublishModal(false);
        setPublishForm({ name: '', description: '', type: 'workflow', price: 0, tags: '' });
        loadItems();
        loadMyItems();
      }
    } catch {}
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={12} fill={i < Math.round(rating) ? '#f59e0b' : 'none'} color={i < Math.round(rating) ? '#f59e0b' : '#475569'} />
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="marketplace-browser" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Store size={20} /> Marketplace</h2>
          <button className="wf-btn" onClick={() => setShowPublishModal(true)}>
            <Plus size={14} /> Publish
          </button>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="mp-toolbar">
          <div className="mp-search">
            <Search size={16} />
            <input
              className="mp-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search marketplace..."
            />
          </div>
          <select className="mp-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="mp-filter" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="mp-grid">
          {items.length === 0 ? (
            <div className="mp-empty">
              <Store size={48} />
              <p>No items found. Be the first to publish!</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="mp-card" onClick={() => setSelectedItem(item)}>
                <div className="mp-card-header">
                  <span className={`mp-type-badge ${item.type}`}>{item.type.replace('_', ' ')}</span>
                  {item.price > 0 && <span className="mp-price">{item.price} cr</span>}
                  {item.price === 0 && <span className="mp-free">Free</span>}
                </div>
                <h3 className="mp-card-title">{item.name}</h3>
                <p className="mp-card-desc">{item.description?.substring(0, 100) || 'No description'}</p>
                <div className="mp-card-meta">
                  <span className="mp-card-author">by {item.user.email.split('@')[0]}</span>
                  <div className="mp-card-stats">
                    <span className="mp-stat"><Download size={12} /> {item.downloads}</span>
                    <span className="mp-stat">{renderStars(item.rating)} {item.ratingCount > 0 ? `(${item.ratingCount})` : ''}</span>
                  </div>
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="mp-card-tags">
                    {item.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="mp-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="mp-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedItem.name}</h3>
              <button className="modal-close" onClick={() => setSelectedItem(null)}><X size={18} /></button>
            </div>
            <div className="mp-detail-body">
              <span className={`mp-type-badge ${selectedItem.type}`}>{selectedItem.type.replace('_', ' ')}</span>
              <p className="mp-detail-desc">{selectedItem.description || 'No description'}</p>
              <div className="mp-detail-meta">
                <span>By {selectedItem.user.email}</span>
                <span>{renderStars(selectedItem.rating)} ({selectedItem.ratingCount} reviews)</span>
                <span><Download size={14} /> {selectedItem.downloads} downloads</span>
              </div>
              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <div className="mp-detail-tags">
                  {selectedItem.tags.map((tag, i) => <span key={i} className="mp-tag">{tag}</span>)}
                </div>
              )}
              <div className="mp-detail-actions">
                <span className="mp-detail-price">
                  {selectedItem.price > 0 ? `${selectedItem.price} credits` : 'Free'}
                </span>
                {selectedItem.userId !== session.user?.id && (
                  <button
                    className="mp-purchase-btn"
                    onClick={() => handlePurchase(selectedItem)}
                    disabled={isPurchasing}
                  >
                    <ShoppingCart size={14} />
                    {isPurchasing ? 'Processing...' : selectedItem.price > 0 ? 'Purchase' : 'Download'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPublishModal && (
        <div className="modal-overlay" onClick={() => setShowPublishModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Publish to Marketplace</h3>
              <button className="modal-close" onClick={() => setShowPublishModal(false)}><X size={18} /></button>
            </div>
            <div className="gen-field">
              <label>Name</label>
              <input className="gen-input" value={publishForm.name} onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })} placeholder="Item name" />
            </div>
            <div className="gen-field" style={{ marginTop: '0.5rem' }}>
              <label>Description</label>
              <input className="gen-input" value={publishForm.description} onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })} placeholder="Description" />
            </div>
            <div className="gen-row" style={{ marginTop: '0.5rem' }}>
              <div className="gen-field small">
                <label>Type</label>
                <select className="gen-select" value={publishForm.type} onChange={(e) => setPublishForm({ ...publishForm, type: e.target.value })}>
                  {TYPES.filter(t => t.value).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="gen-field small">
                <label>Price (credits, 0=free)</label>
                <input className="gen-input" type="number" value={publishForm.price} onChange={(e) => setPublishForm({ ...publishForm, price: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="gen-field" style={{ marginTop: '0.5rem' }}>
              <label>Tags (comma-separated)</label>
              <input className="gen-input" value={publishForm.tags} onChange={(e) => setPublishForm({ ...publishForm, tags: e.target.value })} placeholder="ai, workflow, automation" />
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowPublishModal(false)}>Cancel</button>
              <button className="modal-save" onClick={handlePublish}>Publish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
