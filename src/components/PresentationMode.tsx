import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Download, Plus, Trash2, ArrowLeft, 
  Laptop, TableProperties, Clipboard, Smartphone, Maximize2
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";

// Conexão direta com as chaves que você já configurou na Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
  enrolledAt: string;
}

interface PresentationAttendance {
  id: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

interface PresentationModeProps {
  onBack: () => void;
}

export default function PresentationMode({ onBack }: PresentationModeProps) {
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch { return false; }
  })();

  const [role, setRole] = useState<'presenter' | 'student'>(
    isLockedStudent ? 'student' : 'presenter'
  );

  // Estados locais sincronizados via Supabase
  const [activeToken, setActiveToken] = useState<string>('LIVE-ON95');
  const [timeLeftMs, setTimeLeftMs] = useState<number>(10000);
  const [attendances, setAttendances] = useState<PresentationAttendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Formulário do Aluno
  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentSemester, setStudentSemester] = useState('1º Semestre');
  const [currentStudent, setCurrentStudent] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_student');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState({ type: 'idle', message: '' });
  const [copiedLink, setCopiedLink] = useState(false);

  const getBaseUrl = () => window.location.origin + window.location.pathname;
  const getStudentShareUrl = () => `${getBaseUrl()}?mode=apresentacao_aluno`;
  
  // NOVIDADE: O segundo QR Code agora gera um link real de confirmação para o celular abrir a câmera!
  const getAttendanceQrUrl = () => `${getBaseUrl()}?mode=apresentacao_aluno&token=${activeToken}`;

  // 1. CRONÔMETRO: Gira de 10 em 10 segundos e muda o Token automaticamente
  useEffect(() => {
    const tokens = ['LIVE-ON95', 'TECH-C72', 'NODE-X10', 'DATA-B44', 'CODE-W88'];
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          // Muda o token aleatoriamente quando o tempo zera
          const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
          setActiveToken(randomToken);
          return 10000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // 2. BUSCAR DADOS DO SUPABASE (Atualiza a planilha a cada 2 segundos na tela)
  useEffect(() => {
    if (role !== 'presenter') return;

    const fetchAttendances = async () => {
      const { data, error } = await supabase
        .from('presencas_teste')
        .select('*')
        .order('scannedAt', { ascending: false });

      if (!error && data) {
        if (attendances.length > 0 && data.length > attendances.length) {
          setActiveNotification(`🎉 ${data[0].studentName} acabou de confirmar presença!`);
          setTimeout(() => setActiveNotification(null), 4000);
        }
        setAttendances(data);
      }
    };

    fetchAttendances();
    const poll = setInterval(fetchAttendances, 2000);
    return () => clearInterval(poll);
  }, [role, attendances.length]);

  // Se o aluno escanear o segundo QR Code diretamente, pega o token da URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl && currentStudent) {
      handleScanOrSubmitCode(tokenFromUrl);
    }
  }, [currentStudent]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // SALVAR PERFIL DO ALUNO NO SUPABASE
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) return;

    setIsLoading(true);
    const studentData = {
      id: 'std-' + Math.random().toString(36).substring(2, 9),
      name: studentName,
      course: studentCourse,
      semester: studentSemester
    };

    setCurrentStudent(studentData);
    localStorage.setItem('onclass_pres_active_student', JSON.stringify(studentData));
    setIsLoading(false);
  };

  // CONFIRMAR PRESENÇA DE VERDADE NO SUPABASE
  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent) return;
    if (!codeToSubmit.trim()) {
      setScanStatus({ type: 'error', message: 'Informe o token de 4 letras.' });
      return;
    }

    setIsLoading(true);
    
    const novaPresenca = {
      studentName: currentStudent.name,
      course: currentStudent.course,
      semester: currentStudent.semester,
      tokenUsed: codeToSubmit.trim().toUpperCase(),
      scannedAt: new Date().toISOString()
    };

    const { error } = await supabase.from('presencas_teste').insert([novaPresenca]);

    setIsLoading(false);
    if (!error) {
      setScanStatus({ type: 'success', message: 'Presença confirmada e enviada para a planilha!' });
      setManualCode('');
    } else {
      setScanStatus({ type: 'error', message: 'Erro ao conectar com a planilha do Supabase.' });
    }
  };

  // LIMPAR PLANILHA NO SUPABASE
  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar as participações desta simulação?")) return;
    const { error } = await supabase.from('presencas_teste').delete().neq('id', '0');
    if (!error) {
      setAttendances([]);
      setActiveNotification("✨ Planilha reiniciada!");
      setTimeout(() => setActiveNotification(null), 3000);
    }
  };

  // TESTAR ALUNO FALSO (Direto no Supabase)
  const handleAddDemoStudent = async () => {
    const names = ["Rodrigo Ferreira", "Amanda de Souza", "Carlos Eduardo", "Juliana de Moraes"];
    const courses = ["Engenharia de Software", "Análise de Sistemas", "Administração"];
    
    const fake = {
      studentName: names[Math.floor(Math.random() * names.length)],
      course: courses[Math.floor(Math.random() * courses.length)],
      semester: "3º Semestre",
      tokenUsed: activeToken,
      scannedAt: new Date().toISOString()
    };

    await supabase.from('presencas_teste').insert([fake]);
  };

  const handleDownloadCSV = () => {
    if (attendances.length === 0) return;
    let csv = "data:text/csv;charset=utf-8,Nome,Curso,Semestre,Horario,Token\n";
    attendances.forEach((item) => {
      const hour = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
      csv += `"${item.studentName}","${item.course}","${item.semester}","${hour}","${item.tokenUsed}"\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `chamada_sala_de_aula.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const strokeDashoffset = (timeLeftMs / 10000) * 283;

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col font-sans">
      <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Sala de Aula - Teste Real</h1>
              <p className="text-[10px] text-slate-500">A lista abaixo atualiza sozinha via Supabase</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100">
            <button onClick={() => setRole('presenter')} className={`py-1.5 px-4 rounded-lg text-xs font-bold ${role === 'presenter' ? 'bg-[#0066ff] text-white' : 'text-slate-600'}`}>Projetor</button>
            <button onClick={() => setRole('student')} className={`py-1.5 px-4 rounded-lg text-xs font-bold ${role === 'student' ? 'bg-[#0066ff] text-white' : 'text-slate-600'}`}>Celular Aluno</button>
          </div>
        </div>
      </header>

      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <p className="text-xs font-bold">{activeNotification}</p>
        </div>
      )}

      {role === 'presenter' ? (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {/* QR 1 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
              <span className="text-[11px] font-bold text-blue-600">PASSO 1: ESCANEIE PARA ENTRAR</span>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getStudentShareUrl())}`} className="w-36 h-36 border p-1 bg-white rounded-lg" />
              <span className="text-[10px] text-slate-500 font-mono break-all">{getStudentShareUrl()}</span>
            </div>

            {/* QR 2 */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4 relative">
              <span className="text-[11px] font-bold text-emerald-600">PASSO 2: MARCAR PRESENÇA (ABRE A CÂMERA)</span>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getAttendanceQrUrl())}`} className="w-36 h-36 border p-1 bg-white rounded-lg" />
              <div className="bg-[#10b981] text-white px-4 py-1 rounded-xl font-mono text-sm font-bold tracking-widest">{activeToken}</div>
              
              <div className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-md flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-600">{Math.ceil(timeLeftMs / 1000)}s</span>
              </div>
            </div>
          </div>

          {/* PLANILHA */}
          <div className="col-span-1 lg:col-span-3 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-md p-6">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Alunos Presentes na Sala</h3>
              <div className="flex gap-2">
                <button onClick={handleAddDemoStudent} className="py-1 px-3 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">+ Testar</button>
                <button onClick={handleDownloadCSV} className="py-1 px-3 bg-[#0066ff] text-white text-xs font-bold rounded-lg">Exportar CSV</button>
                <button onClick={handleResetData} className="p-1.5 bg-red-50 text-red-500 rounded-lg"><Trash2 className="w-4 4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-auto max-h-[350px]">
              {attendances.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">Nenhuma presença confirmada ainda. Aguardando alunos escanearem...</p>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold">
                    <tr>
                      <th className="p-2.5">Nome</th>
                      <th className="p-2.5">Curso</th>
                      <th className="p-2.5">Semestre</th>
                      <th className="p-2.5">Horário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendances.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold">{item.studentName}</td>
                        <td className="p-2.5 text-slate-500">{item.course}</td>
                        <td className="p-2.5">{item.semester}</td>
                        <td className="p-2.5 font-mono text-slate-400">{new Date(item.scannedAt).toLocaleTimeString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      ) : (
        /* TELA DO ALUNO */
        <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 space-y-4">
              <h3 className="text-base font-black text-[#0b1c30] text-center">Identificação do Aluno</h3>
              <form onSubmit={handleEnrollStudent} className="space-y-3">
                <input type="text" required placeholder="Seu Nome Completo" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full text-xs bg-slate-50 border p-3 rounded-xl outline-none" />
                <input type="text" required placeholder="Seu Curso" value={studentCourse} onChange={(e) => setStudentCourse(e.target.value)} className="w-full text-xs bg-slate-50 border p-3 rounded-xl outline-none" />
                <select value={studentSemester} onChange={(e) => setStudentSemester(e.target.value)} className="w-full text-xs bg-slate-50 border p-3 rounded-xl outline-none">
                  <option>1º Semestre</option>
                  <option>2º Semestre</option>
                  <option>3º Semestre</option>
                  <option>Outro</option>
                </select>
                <button type="submit" className="w-full bg-[#0066ff] text-white py-3 rounded-xl font-bold text-xs">Salvar Meus Dados</button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 text-center space-y-4">
              <p className="text-xs text-slate-500">Olá, <strong className="text-slate-800">{currentStudent.name}</strong>!</p>
              
              {scanStatus.type !== 'success' ? (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700">Insira o código de 4 letras do telão:</p>
                  <input type="text" placeholder="Ex: LIVE" value={manualCode} onChange={(e) => setManualCode(e.target.value)} className="w-full text-center font-mono text-lg font-bold tracking-widest bg-slate-50 border p-3 rounded-xl outline-none" />
                  <button onClick={() => handleScanOrSubmitCode(manualCode)} className="w-full bg-[#10b981] text-white py-3 rounded-xl font-bold text-xs">Confirmar Presença</button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {scanStatus.message}
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
