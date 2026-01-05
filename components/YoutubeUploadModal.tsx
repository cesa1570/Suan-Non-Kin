import React, { useState, useEffect, useRef } from 'react';
import { Youtube, X, Send, Loader2, CheckCircle2, AlertCircle, Globe, Lock, EyeOff, Hash, AlertTriangle, Clock } from 'lucide-react';
import { uploadVideoToYouTube } from '../services/youtubeService';

interface YoutubeUploadModalProps {
  videoBlob: Blob;
  initialTitle: string;
  initialDescription: string;
  initialTags?: string[];
  onClose: () => void;
}

const YoutubeUploadModal: React.FC<YoutubeUploadModalProps> = ({
  videoBlob, initialTitle, initialDescription, initialTags = [], onClose
}) => {
  const [title, setTitle] = useState(initialTitle.substring(0, 100));
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState(initialTags.join(', '));
  const [scheduledTime, setScheduledTime] = useState<string>(''); // [เพิ่ม] State เก็บเวลา
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('private');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);

  // Ref to store interval for cleanup
  const progressInterval = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  const handleClose = () => {
    if (isUploading) {
      if (!confirm("Upload is in progress. Are you sure you want to cancel?")) return;
    }
    onClose();
  };

  const handleUpload = async () => {
    const token = localStorage.getItem('yt_access_token');
    if (!token) {
      setError("YouTube Account not connected. Please go to Settings/Profile to connect YouTube.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setIsQuotaError(false);
    setUploadProgress(5);

    progressInterval.current = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return 90;
        return prev + Math.random() * 5;
      });
    }, 800);

    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      // [เพิ่ม] เตรียมค่า publishAt เป็น ISO string (UTC)
      let publishAtISO = undefined;
      if (scheduledTime) {
         const dateObj = new Date(scheduledTime);
         publishAtISO = dateObj.toISOString();
      }

      // ส่ง publishAtISO ไปยังฟังก์ชัน upload
      const result = await uploadVideoToYouTube(
        videoBlob,
        title,
        description,
        token,
        privacy,
        tagArray,
        publishAtISO
      );

      if (progressInterval.current) clearInterval(progressInterval.current);
      setUploadProgress(100);
      setSuccess(result);

      try {
        const historyStr = localStorage.getItem('yt_upload_history');
        const history = historyStr ? JSON.parse(historyStr) : [];
        history.unshift({
          id: Date.now(),
          videoId: result.id,
          title: title,
          // บันทึกสถานะให้ถูกต้อง (ถ้ามีเวลา = Scheduled)
          status: scheduledTime ? 'Scheduled' : (privacy.charAt(0).toUpperCase() + privacy.slice(1)),
          date: new Date().toISOString(),
          publishAt: publishAtISO
        });
        localStorage.setItem('yt_upload_history', JSON.stringify(history.slice(0, 20)));
      } catch (e) {
        console.error("Failed to save history", e);
      }

    } catch (err: any) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setUploadProgress(0);
      
      let errorMsg = err.message || "Upload failed.";
      
      if (err.message === "YOUTUBE_QUOTA_EXCEEDED") {
        setIsQuotaError(true);
        errorMsg = "YouTube API Quota Exceeded. โควต้า Google Cloud รายวันของคุณเต็มแล้ว (10,000 units). หมายเหตุ: การอัปโหลดวิดีโอ 1 ครั้งใช้ 1,600 units.";
      } else if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
        errorMsg = "Session expired. Please reconnect your YouTube account.";
      } else if (errorMsg.includes("403")) {
        errorMsg = "Permission Denied. Your Token might be missing 'youtube.upload' scope.";
      }

      setError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-950 border border-slate-800 rounded-[3rem] w-full max-w-3xl p-10 relative shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <button
          onClick={handleClose}
          disabled={isUploading}
          className={`absolute top-8 right-8 transition active:scale-90 z-10 ${isUploading ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-white'}`}
        >
          <X size={28} />
        </button>

        <div className="flex items-center gap-4 mb-8 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-900/30">
            <Youtube size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">YouTube Publication</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Broadcast your masterpiece to the world</p>
          </div>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-6 animate-in zoom-in-95 duration-500 overflow-y-auto">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={48} />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Upload Successful!</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto font-kanit">
                {scheduledTime 
                  ? `Your video has been scheduled. It will automatically go public on ${new Date(scheduledTime).toLocaleString()}.`
                  : "Your video has been sent to YouTube Studio for processing. It will appear on your channel shortly."}
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <a href={`https://youtu.be/${success.id}`} target="_blank" rel="noreferrer" className="px-10 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-900/20 hover:bg-red-500 transition-all hover:scale-105 active:scale-95">View on YouTube</a>
              <button onClick={onClose} className="px-10 py-4 bg-slate-900 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest border border-slate-800 hover:text-white transition-all">Done</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 space-y-6">
            {error && (
              <div className={`${isQuotaError ? 'bg-orange-500/10 border-orange-500/30' : 'bg-red-500/10 border-red-500/30'} p-5 rounded-[2rem] flex items-start gap-4 animate-in shake-1 duration-300`}>
                {isQuotaError ? <AlertTriangle size={20} className="text-orange-500 shrink-0 mt-0.5" /> : <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isQuotaError ? 'text-orange-400' : 'text-red-400'}`}>
                    {isQuotaError ? 'Service Quota Reached' : 'Configuration Error'}
                  </p>
                  <p className={`text-sm font-medium font-kanit ${isQuotaError ? 'text-orange-200' : 'text-red-200'}`}>{error}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Video Title (Required)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={100}
                    disabled={isUploading}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-base font-kanit outline-none focus:ring-2 focus:ring-red-600/30 transition-all disabled:opacity-50"
                  />
                  <div className="flex justify-between mt-2 px-1">
                    <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Max character limit</span>
                    <span className={`text-[9px] font-black ${title.length > 90 ? 'text-orange-500' : 'text-slate-500'}`}>{title.length}/100</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Privacy Engine</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'private', label: 'Private', icon: <Lock size={14} /> },
                      { id: 'unlisted', label: 'Unlisted', icon: <EyeOff size={14} /> },
                      { id: 'public', label: 'Public', icon: <Globe size={14} /> },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setPrivacy(opt.id as any);
                          // ถ้าเลือก Privacy อื่น ให้ล้างค่าเวลา (เพราะ Schedule ต้องคู่กับ Private)
                          if (scheduledTime) setScheduledTime('');
                        }}
                        disabled={isUploading}
                        className={`py-4 rounded-2xl text-[10px] font-black uppercase flex flex-col items-center gap-2 border transition-all disabled:opacity-50 ${privacy === opt.id ? 'bg-red-600 border-red-500 text-white shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'}`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* [เพิ่ม] ส่วนตั้งเวลาลงคลิป */}
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-colors">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <Clock size={12} className="text-blue-500" /> Schedule Publication (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => {
                      setScheduledTime(e.target.value);
                      if (e.target.value) setPrivacy('private');
                    }}
                    disabled={isUploading}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-kanit outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50 appearance-none"
                    style={{ colorScheme: 'dark' }}
                  />
                  {scheduledTime && (
                    <div className="mt-3 flex items-start gap-2 text-[10px] text-blue-400/80 bg-blue-500/5 p-2 rounded-lg border border-blue-500/10">
                       <AlertCircle size={12} className="mt-0.5 shrink-0" />
                       <p>Visibility will be locked to 'Private' until {new Date(scheduledTime).toLocaleString()}.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1 flex items-center gap-2">
                    <Hash size={12} /> Global Metadata Tags
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="funny, viral, ai..."
                    disabled={isUploading}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white text-sm font-kanit outline-none focus:ring-2 focus:ring-red-600/30 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block ml-1">Algorithm Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isUploading}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white text-sm font-kanit h-full min-h-[340px] lg:min-h-[420px] outline-none focus:ring-2 focus:ring-red-600/30 transition-all resize-none scrollbar-thin scrollbar-thumb-slate-800 disabled:opacity-50"
                    placeholder="Detailed video content for SEO..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-900 mt-4 shrink-0">
              {isUploading ? (
                <div className="space-y-5 px-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="animate-spin text-red-500" />
                      <span className="text-sm font-black text-white uppercase tracking-[0.2em] animate-pulse">
                        Uploading Content...
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-red-500 bg-red-500/10 px-3 py-1 rounded-full">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-1 border border-slate-800">
                    <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(220,38,38,0.6)]" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleUpload}
                  disabled={!title || isQuotaError}
                  className={`w-full py-6 text-white rounded-[2.5rem] font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group ${isQuotaError ? 'bg-slate-800 shadow-none' : 'bg-red-600 shadow-red-900/40 hover:bg-red-50'}`}
                >
                  {scheduledTime ? (
                     <>
                        <Clock size={24} className="group-hover:-rotate-12 transition-transform" />
                        {isQuotaError ? 'Quota Exceeded' : 'Schedule Publication'}
                     </>
                  ) : (
                     <>
                        <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        {isQuotaError ? 'Quota Exceeded' : 'Launch Publication'}
                     </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default YoutubeUploadModal;