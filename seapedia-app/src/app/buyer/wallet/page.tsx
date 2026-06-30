'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useRouter } from 'next/navigation'

const INDONESIA_REGIONS: Record<string, string[]> = {
  'DKI Jakarta': ['Jakarta Pusat', 'Jakarta Utara', 'Jakarta Barat', 'Jakarta Selatan', 'Jakarta Timur', 'Kepulauan Seribu'],
  'Jawa Barat': ['Bandung', 'Bekasi', 'Bogor', 'Depok', 'Cimahi', 'Cirebon', 'Sukabumi', 'Tasikmalaya', 'Banjar'],
  'Jawa Tengah': ['Semarang', 'Surakarta (Solo)', 'Magelang', 'Salatiga', 'Tegal', 'Pekalongan'],
  'DI Yogyakarta': ['Yogyakarta', 'Sleman', 'Bantul', 'Gunungkidul', 'Kulon Progo'],
  'Jawa Timur': ['Surabaya', 'Malang', 'Sidoarjo', 'Gresik', 'Kediri', 'Madiun', 'Batu', 'Probolinggo', 'Pasuruan', 'Mojokerto', 'Blitar'],
  'Banten': ['Tangerang', 'Tangerang Selatan', 'Serang', 'Cilegon'],
  'Bali': ['Denpasar', 'Badung', 'Gianyar', 'Buleleng', 'Tabanan', 'Klungkung', 'Bangli', 'Karangasem', 'Jembrana'],
  'Sumatera Utara': ['Medan', 'Binjai', 'Pematangsiantar', 'Deli Serdang', 'Tanjungbalai', 'Tebing Tinggi', 'Sibolga', 'Padangsidimpuan'],
  'Sulawesi Selatan': ['Makassar', 'Gowa', 'Maros', 'Parepare', 'Palopo']
}

export default function ProfileWalletPage() {
  const router = useRouter()
  const { user, updateWallet } = useAuthStore()
  const toast = useToast()
  
  const [data, setData] = useState<{ balance: number, transactions: any[] } | null>(null)
  const [profile, setProfile] = useState<{ id: string, name: string, email: string, address: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState<number | ''>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Role Activation States
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false)
  const [storeNameInput, setStoreNameInput] = useState('')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [detailAddressInput, setDetailAddressInput] = useState('')
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [isActivatingRole, setIsActivatingRole] = useState(false)
  const fetchData = async () => {
    try {
      const [walletRes, profileRes] = await Promise.all([
        fetch('/api/buyer/wallet'),
        fetch('/api/buyer/profile')
      ])
      
      if (walletRes.ok) setData(await walletRes.json())
      if (profileRes.ok) {
        const prof = await profileRes.json()
        setProfile(prof)
        setNameInput(prof.name || '')
        setEmailInput(prof.email || '')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topupAmount || topupAmount < 10000) {
      toast.error('Minimal Top-Up Rp 10.000')
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch('/api/buyer/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(topupAmount) })
      })
      
      const resData = await res.json()
      
      if (res.ok) {
        toast.success(resData.message)
        updateWallet(resData.newBalance)
        setIsTopupModalOpen(false)
        setTopupAmount('')
        fetchData()
      } else {
        toast.error(resData.error || 'Gagal Top-Up')
      }
    } catch (err) {
      toast.error('Terjadi kesalahan')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput, email: emailInput })
      })
      const resData = await res.json()
      if (res.ok) {
        toast.success('Profil berhasil disimpan')
        setProfile(resData)
        setIsEditingProfile(false)
      } else {
        toast.error(resData.error || 'Gagal menyimpan profil')
      }
      fetchData() // Refresh profile
    } catch (err) {
      toast.error('Gagal terhubung ke server')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleActivateRole = async (role: 'SELLER' | 'DRIVER', e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsActivatingRole(true)
    try {
      const payload: any = { role }
      if (role === 'SELLER') {
        payload.storeName = storeNameInput
        payload.storeAddress = `${detailAddressInput}, ${selectedCity}, ${selectedProvince}`
      }

      const res = await fetch('/api/auth/roles/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal mengaktifkan peran')

      toast.success(result.message)
      // Update global auth store with new user data
      useAuthStore.getState().setAuth(result.user, result.token)
      setIsStoreModalOpen(false)
      setIsDriverModalOpen(false)
      
      // Redirect to the correct dashboard automatically
      if (role === 'SELLER') {
        router.push('/seller/dashboard')
      } else if (role === 'DRIVER') {
        router.push('/driver/dashboard')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsActivatingRole(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    setTopupAmount(raw ? Number(raw) : '')
  }

  const getTxIconInfo = (type: string) => {
    switch(type) {
      case 'TOPUP': return { icon: 'arrow_downward', color: 'bg-tertiary/10 text-tertiary', label: 'Top-Up' }
      case 'PAYMENT': return { icon: 'arrow_upward', color: 'bg-error/10 text-error', label: 'Pembayaran' }
      case 'REFUND': return { icon: 'undo', color: 'bg-primary/10 text-primary', label: 'Refund' }
      case 'COMMISSION': return { icon: 'payments', color: 'bg-purple-100 text-purple-700', label: 'Komisi' }
      default: return { icon: 'swap_horiz', color: 'bg-surface-variant text-on-surface-variant', label: 'Transaksi' }
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant p-6">
          <h2 className="text-title-lg font-bold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_circle</span>
            Profil Saya
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 shimmer w-1/2"></div>
              <div className="h-4 shimmer w-3/4"></div>
              <div className="h-20 shimmer w-full"></div>
            </div>
          ) : profile ? (
            isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Nama Lengkap</label>
                  <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="input mt-1" required />
                </div>
                <div>
                  <label className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Email</label>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="input mt-1" required />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={isSavingProfile} className="btn-primary py-2 flex-grow">
                    {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}
                  </button>
                  <button type="button" onClick={() => setIsEditingProfile(false)} className="btn bg-surface-container hover:bg-surface-container-high py-2">
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 relative">
                <button onClick={() => setIsEditingProfile(true)} className="absolute -top-10 right-0 text-primary hover:text-primary-container p-2 rounded-full hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Nama Lengkap</p>
                  <p className="font-bold text-on-surface">{profile.name}</p>
                </div>
                <div>
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Email</p>
                  <p className="font-bold text-on-surface">{profile.email}</p>
                </div>
              </div>
            )
          ) : (
            <p>Gagal memuat profil</p>
          )}
        </div>

        {/* Wallet Card */}
        <div className="hero-gradient rounded-2xl p-6 text-white shadow-float relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=1000')] bg-cover bg-center mix-blend-overlay opacity-20"></div>
          <div className="relative z-10 mb-6">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              Saldo Wallet SEAPEDIA
            </p>
            {isLoading ? (
              <div className="h-10 w-48 bg-white/20 rounded animate-pulse"></div>
            ) : (
              <h1 className="text-4xl font-black drop-shadow-sm">
                Rp {data?.balance.toLocaleString('id-ID')}
              </h1>
            )}
          </div>
          <button 
            onClick={() => setIsTopupModalOpen(true)}
            className="relative z-10 btn bg-white text-primary hover:bg-surface-container-low w-full shadow-sm mt-auto"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Top-Up Saldo
          </button>
        </div>
      </div>

      {/* Role Activation Section */}
      <div className="mb-8">
        <h2 className="text-title-md font-bold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">military_tech</span>
          Tingkatkan Potensi Akun Anda
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!user?.roles.includes('SELLER') ? (
            <div className="card p-6 bg-gradient-to-br from-white to-primary/5 border border-primary/20 flex flex-col justify-between items-start group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">storefront</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Buka Toko Gratis</h3>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                  Mulai berjualan di SEAPEDIA dan jangkau jutaan pembeli di seluruh Indonesia tanpa biaya pendaftaran.
                </p>
              </div>
              <button 
                onClick={() => setIsStoreModalOpen(true)}
                className="btn-primary w-full group-hover:shadow-md transition-all"
              >
                Mulai Berjualan
              </button>
            </div>
          ) : (
            <div className="card p-6 bg-surface-container-lowest border border-outline-variant flex items-center justify-between opacity-80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Penjual Aktif</h3>
                  <p className="text-xs text-on-surface-variant">Anda sudah memiliki akses Penjual</p>
                </div>
              </div>
            </div>
          )}

          {!user?.roles.includes('DRIVER') ? (
            <div className="card p-6 bg-gradient-to-br from-white to-teal-50 border border-teal-200 flex flex-col justify-between items-start group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <h3 className="text-lg font-bold text-on-surface mb-2">Gabung Mitra Kurir</h3>
                <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                  Jadilah pahlawan pengiriman SEAPEDIA dan dapatkan penghasilan tambahan tanpa batas waktu kerja.
                </p>
              </div>
              <button 
                onClick={() => setIsDriverModalOpen(true)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                Daftar Driver
              </button>
            </div>
          ) : (
            <div className="card p-6 bg-surface-container-lowest border border-outline-variant flex items-center justify-between opacity-80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">Driver Aktif</h3>
                  <p className="text-xs text-on-surface-variant">Anda sudah memiliki akses Mitra Kurir</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-title-md font-bold mb-4">Riwayat Transaksi</h2>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-4 h-20 shimmer"></div>
            ))}
          </div>
        ) : data?.transactions && data.transactions.length > 0 ? (
          <div className="card bg-white overflow-hidden divide-y divide-outline-variant">
            {data.transactions.map((tx: any) => {
              const info = getTxIconInfo(tx.type)
              const isNegative = tx.amount < 0
              
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-surface-container-lowest transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${info.color}`}>
                      <span className="material-symbols-outlined">{info.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{info.label}</h4>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">{tx.description}</p>
                      <p className="text-[10px] text-outline mt-1 font-mono">
                        {new Date(tx.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className={`font-bold shrink-0 pl-2 ${isNegative ? 'text-on-surface' : 'text-tertiary'}`}>
                    {isNegative ? '-' : '+'} Rp {Math.abs(tx.amount).toLocaleString('id-ID')}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-outline-variant shadow-sm">
            <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">history</span>
            <h3 className="text-title-md font-bold text-on-surface">Belum ada transaksi</h3>
          </div>
        )}
      </div>

      <Modal isOpen={isTopupModalOpen} onClose={() => setIsTopupModalOpen(false)} title="Top-Up Saldo Wallet">
        <form onSubmit={handleTopup} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {[50000, 100000, 250000, 500000].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => setTopupAmount(amt)}
                className={`p-2 text-sm rounded-lg border font-semibold transition-colors ${
                  topupAmount === amt 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
                }`}
              >
                {amt / 1000}K
              </button>
            ))}
          </div>
          
          <div>
            <label className="label">Atau masukkan nominal lain</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-outline-variant">Rp</span>
              <input
                type="text"
                value={topupAmount ? topupAmount.toLocaleString('id-ID') : ''}
                onChange={handleAmountChange}
                className="input pl-12 font-bold"
                placeholder="0"
                required
              />
            </div>
            <p className="text-xs text-on-surface-variant mt-2">*Minimal top-up Rp 10.000</p>
          </div>

          <button 
            type="submit" 
            disabled={isProcessing || !topupAmount || topupAmount < 10000} 
            className="w-full btn-primary"
          >
            {isProcessing ? 'Memproses...' : 'Lanjutkan Pembayaran'}
          </button>
        </form>
      </Modal>

      {/* Role Activation Modals */}
      <Modal isOpen={isStoreModalOpen} onClose={() => !isActivatingRole && setIsStoreModalOpen(false)} title="Setup Toko Anda">
        <form onSubmit={(e) => handleActivateRole('SELLER', e)} className="space-y-4">
          <p className="text-sm text-on-surface-variant mb-4">Lengkapi informasi dasar di bawah ini untuk mengaktifkan fitur Penjual di akun Anda.</p>
          <div>
            <label className="text-xs text-on-surface-variant uppercase font-semibold">Nama Toko *</label>
            <input 
              type="text" 
              required 
              value={storeNameInput} 
              onChange={(e) => setStoreNameInput(e.target.value)}
              className="input mt-1" 
              placeholder="Contoh: Toko Elektronik Maju"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant uppercase font-semibold">Provinsi *</label>
            <select 
              required 
              value={selectedProvince} 
              onChange={(e) => {
                setSelectedProvince(e.target.value)
                setSelectedCity('') // Reset kota saat provinsi berubah
              }}
              className="input mt-1 appearance-none cursor-pointer" 
            >
              <option value="" disabled>-- Pilih Provinsi --</option>
              {Object.keys(INDONESIA_REGIONS).map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant uppercase font-semibold">Kota / Kabupaten *</label>
            <select 
              required 
              value={selectedCity} 
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedProvince}
              className="input mt-1 appearance-none cursor-pointer disabled:opacity-50 disabled:bg-surface-container-low" 
            >
              <option value="" disabled>-- Pilih Kota --</option>
              {selectedProvince && INDONESIA_REGIONS[selectedProvince].map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant uppercase font-semibold">Detail Alamat & Patokan *</label>
            <textarea 
              required 
              value={detailAddressInput} 
              onChange={(e) => setDetailAddressInput(e.target.value)}
              className="input mt-1 h-20 resize-none text-sm placeholder:text-outline/60" 
              placeholder="Contoh: Jl. Merdeka No.45, RT 01/RW 02. Patokan: Seberang Indomaret, rumah pagar hitam."
            />
          </div>
          <button type="submit" disabled={isActivatingRole || !storeNameInput || !selectedProvince || !selectedCity || !detailAddressInput} className="btn-primary w-full py-3 mt-2">
            {isActivatingRole ? 'Memproses...' : 'Buka Toko Sekarang'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isDriverModalOpen} onClose={() => !isActivatingRole && setIsDriverModalOpen(false)} title="Gabung Mitra Kurir">
        <div className="space-y-6 text-center">
          <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">local_shipping</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface mb-2">Siap Mengantar Pesanan?</h3>
            <p className="text-sm text-on-surface-variant">Dengan menekan tombol di bawah, Anda menyetujui syarat & ketentuan Mitra Kurir SEAPEDIA dan akan langsung mendapatkan akses ke Papan Pekerjaan Driver.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setIsDriverModalOpen(false)} 
              disabled={isActivatingRole}
              className="btn bg-surface-container hover:bg-surface-container-high w-full py-3"
            >
              Nanti Saja
            </button>
            <button 
              onClick={() => handleActivateRole('DRIVER')} 
              disabled={isActivatingRole}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold w-full py-3 rounded-xl transition-colors"
            >
              {isActivatingRole ? 'Memproses...' : 'Setuju & Gabung'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
