import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Download, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  ArrowRight,
  Clipboard,
  Smartphone,
  Maximize2,
  X
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from 'qrcode.react';

// Inicializa o cliente do Supabase usando as variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
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
  studentId: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

interface PresentationModeProps {
  onBack: () => void;
  initialOverrideMode?: 'presenter' | 'student';
}

export default function PresentationMode({ onBack, initialOverrideMode }: PresentationModeProps) {
  const isLockedStudent = (() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mode') === 'apresentacao_aluno';
    } catch {
      return false;
    }
  })();

  const [role, setRole] = useState<'presenter' | 'student'>(() => {
    if (isLockedStudent) return 'student';
    if (initialOverrideMode) return initialOverrideMode;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') === 'apresentacao_aluno' ? 'student' : 'presenter';
  });

  const [activeToken, setActiveToken] = useState<string>('LIVE-ON95');
  const [timeLeftMs, setTimeLeftMs] = useState<number>(10000);
  const [students, setStudents] = useState<PresentationStudent[]>([]);
  const [attendances, setAttendances] = useState<PresentationAttendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [studentSemester, setStudentSemester] = useState('1º Semestre');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(() => {
    try {
      const saved = localStorage.getItem('onclass_pres_active_student');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: ''
  });

  const [copiedLink, setCopiedLink] = useState(false);

  const getStudentShareUrl = () => {
    const origin = window.location.origin + window.location.pathname;
    return `${origin}?mode=apresentacao_aluno`;
  };

  // Captura o token automático vindo do QR Code para o aluno
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      if (tokenParam) {
        setManualCode(tokenParam.toUpperCase());
      }
    } catch (e) {}
  }, [role]);

  // Sincronização em tempo real direta com as tabelas do Supabase
  useEffect(() => {
    if (!supabaseUrl) return;

    const loadData = async () => {
      try {
        const { data: attData } = await supabase.from('attendances').select('*').order('scannedAt', { ascending: false });
        if (attData) setAttendances(attData);
        
        const { data: stdData } = await supabase.from('students').select('*');
        if (stdData) setStudents(stdData);
      } catch (err) {
        console.warn("Tabelas do Supabase indisponíveis. Usando simulação local.");
      }
    };

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Cronómetro rotativo do Token (10 segundos)
  useEffect(() => {
    const tokens = ['LIVE-ON95', 'TECH-77X', 'CODE-404', 'DATA-99B', 'VITE-2026'];
    const interval = setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 100) {
          const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
          setActiveToken(randomToken);
          return 10000;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getStudentShareUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) {
      alert("Por favor, preencha o seu nome e curso.");
      return;
    }

    setIsLoading(true);
    const mockStudent: PresentationStudent = {
      id: 'std-' + Math.random().toString(36).substring(2, 7),
      name: studentName,
      course: studentCourse,
      semester: studentSemester,
      enrolledAt: new Date().toISOString()
    };

    try {
      await supabase.from('students').insert([{
        id: mockStudent.id,
        name: mockStudent.name,
        course: mockStudent.course,
        semester: mockStudent.semester
      }]);
    } catch (err) {
      console.log("Modo de simulação local ativo");
    }

    setStudents(prev => [mockStudent, ...prev]);
    setCurrentStudent(mockStudent);
    localStorage.setItem('onclass_pres_active_student', JSON.stringify(mockStudent));
    setIsLoading(false);
  };

  const handleScanOrSubmitCode = async (codeToSubmit: string) => {
    if (!currentStudent) return;
    if (!codeToSubmit.trim()) {
      setScanStatus({ type: 'error', message: 'Por favor, informe o token de 4 letras do projetor.' });
      return;
    }

    if (codeToSubmit.trim().toUpperCase() !== activeToken) {
      setScanStatus({ type: 'error', message: 'Token incorreto ou expirado. Aguarde o próximo código!' });
      return;
    }

    setIsLoading(true);
    const newAttendance: PresentationAttendance = {
      id: 'att-' + Math.random().toString(36).substring(2, 7),
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      course: currentStudent.course,
      semester: currentStudent.semester,
      scannedAt: new Date().toISOString(),
      tokenUsed: activeToken
    };

    try {
      await supabase.from('attendances').insert([{
        student_id: newAttendance.studentId,
        student_name: newAttendance.studentName,
        course: newAttendance.course,
        semester: newAttendance.semester,
        token_used: newAttendance.tokenUsed
      }]);
    } catch (err) {
      console.log("Presença registada localmente");
    }

    setAttendances(prev => [newAttendance, ...prev]);
    setActiveNotification(`🎉 ${currentStudent.name} confirmou presença!`);
    setTimeout(() => setActiveNotification(null), 4000);
    setScanStatus({ type: 'success', message: 'Presença confirmada no dashboard!' });
    setManualCode('');
    setIsLoading(false);
  };

  const handleResetData = async () => {
    if (!window.confirm("Deseja realmente limpar as participações desta simulação?")) return;
    try {
      await supabase.from('attendances').delete().neq('id', '0');
      await supabase.from('students').delete().neq('id', '0');
    } catch (e) {}
    setStudents([]);
    setAttendances([]);
    setActiveNotification("✨ Simulação reiniciada com sucesso!");
    setTimeout(() => setActiveNotification(null), 3000);
  };

  const handleAddDemoStudent = () => {
    const randomNames = ["Rodrigo Ferreira Mendes", "Amanda de Souza Lima", "Carlos Eduardo Pinho", "Juliana de Moraes"];
    const randomCourses = ["Engenharia de Software", "Análise e Desenv. de Sistemas", "Administração de Empresas"];
    const chosenName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const chosenCourse = randomCourses[Math.floor(Math.random() * randomCourses.length)];

    const mockStd: PresentationStudent = {
      id: 'mock-' + Math.random().toString(36).substring(2, 7),
      name: chosenName,
      course: chosenCourse,
      semester: '3º Semestre',
      enrolledAt: new Date().toISOString()
    };

    const mockAtt: PresentationAttendance = {
      id: 'mock-att-' + Math.random().toString(36).substring(2, 7),
      studentId: mockStd.id,
      studentName: mockStd.name,
      course: mockStd.course,
      semester: mockStd.semester,
      scannedAt: new Date().toISOString(),
      tokenUsed: activeToken
    };

    setStudents(prev => [mockStd, ...prev]);
    setAttendances(prev => [mockAtt, ...prev]);
  };

  const handleDownloadCSV = () => {
    if (attendances.length === 0) {
      alert("Nenhum registro de presença para exportar!");
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,Nome Completo,Curso,Semestre,Horario,Token\n";
    attendances.forEach((item) => {
      const hour = new Date(item.scannedAt).toLocaleTimeString('pt-BR');
      csvContent += `"${item.studentName}","${item.course}","${item.semester}","${hour}","${item.tokenUsed}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chamada_onclass.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col">
      <header className="bg-white border-b border-blue-100 py-3.5 px-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-[#0b1c30]">OnClass Showcase Pro (Supabase Ativo)</h1>
              <p className="text-[10px] text-slate-500 font-medium">Demonstração Conectada Direto ao Banco de Dados</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#f0f6ff] p-1 rounded-xl border border-blue-100 w-full sm:w-auto">
            <button
              onClick={() => setRole('presenter')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'presenter' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}
            >
              <Laptop className="w-3.5 h-3.5" /> Projetor (Professor)
            </button>
            <button
              onClick={() => setRole('student')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-lg text-xs font-bold transition-all cursor-pointer ${role === 'student' ? 'bg-[#0066ff] text-white shadow-sm' : 'text-slate-600'}`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Celular (Participante)
            </button>
          </div>
        </div>
      </header>

      {activeNotification && role === 'presenter' && (
        <div className="fixed top-20 right-6 z-50 bg-[#091e3a] text-white p-4 rounded-2xl shadow-2xl border border-blue-500/30 flex items-center gap-3 max-w-sm">
          <span>✨</span>
          <p className="text-xs font-bold leading-tight">{activeNotification}</p>
        </div>
      )}

      {role === 'presenter' ? (
        <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[#0b1c30]">Como apresentar?</h3>
              <p className="text-xs text-slate-600">Projete esta tela. Peça para usarem o QR Code 1 para entrar e validarem com o QR Code 2.</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4">
              <h4 className="text-xs font-black text-slate-800">Passo 1: Entrar no App</h4>
              <div className="bg-white p-2 rounded-xl border shadow-sm">
                <QRCodeSVG 
                  value={getStudentShareUrl()}
                  size={144}
                />
              </div>
              <div className="flex bg-[#f1f5f9] border rounded-lg p-2 items-center justify-between w-full">
                <span className="text-[9px] text-slate-600 truncate text-left flex-1">{getStudentShareUrl()}</span>
                <button onClick={handleCopyLink} className="bg-[#0066ff] text-white text-[9px] px-2.5 py-1 rounded-md ml-2">
                  {copiedLink ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-4 relative">
              <h4 className="text-xs font-black text-slate-800">Passo 2: Registro de Presença</h4>
              <div className="bg-[#f0fdf4] p-4 rounded-2xl border-2 border-emerald-500/30 flex flex-col items-center w-full max-w-[200px]">
                <div className="bg-white p-2 rounded-xl border shadow-sm mb-2">
                  <QRCodeSVG 
                    value={getStudentShareUrl() + '&token=' + activeToken}
                    size={144}
                  />
                </div>
                <div className="mt-2 bg-[#10b981] text-white px-4 py-1 rounded-xl font-mono text-sm font-bold tracking-widest">
                  {activeToken}
                </div>
              </div>
              <div className="absolute top-4 right-4 bg-white p-1.5 border rounded-full shadow flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-700">{Math.ceil(timeLeftMs / 1000)}s</span>
              </div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-3 flex flex-col bg-white rounded-3xl border shadow-md p-6 min-h-[500px]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-5 mb-5">
              <div className="flex items-center gap-3">
                <TableProperties className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Planilha de Chamada (Real-time)</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button onClick={handleAddDemoStudent} className="py-1.5 px-3 rounded-xl bg-blue-50 text-[#0066ff] text-xs font-bold border">
                  + Testar Aluno
                </button>
                <button onClick={handleDownloadCSV} className="py-1.5 px-3 rounded-xl bg-[#0066ff] text-white text-xs font-bold shadow-sm">
                  Exportar CSV
                </button>
                <button onClick={handleResetData} className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 border">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-[#f8f9ff] rounded-2xl p-3 border text-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Inscritos</span>
                <span className="text-lg font-black text-slate-800">{students.length}</span>
              </div>
              <div className="bg-[#ecfdf5] rounded-2xl p-3 border text-center">
                <span className="text-[9px] text-emerald-600 font-bold uppercase block">Presenças</span>
                <span className="text-lg font-black text-emerald-600">{attendances.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-2xl max-h-[380px]">
              {attendances.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">Nenhuma presença computada ainda.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#f8fafc] sticky top-0 border-b font-bold text-slate-600">
                    <tr>
                      <th className="p-3 pl-4">Nome</th>
                      <th className="p-3">Curso</th>
                      <th className="p-3">Horário</th>
                      <th className="p-3 text-center">Token</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium text-slate-700">
                    {attendances.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 pl-4 font-bold text-slate-900">{item.studentName}</td>
                        <td className="p-3 text-slate-500">{item.course}</td>
                        <td className="p-3 text-slate-400">{new Date(item.scannedAt).toLocaleTimeString('pt-BR')}</td>
                        <td className="p-3 text-center font-mono text-emerald-600 font-bold">{item.tokenUsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-lg mx-auto w-full p-4 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border shadow-lg p-6 space-y-4">
              <h3 className="text-base font-black text-center text-[#0b1c30]">Ficha do Participante</h3>
              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Seu Nome Completo</label>
                  <input
                    type="text" required placeholder="Ex: Amanda Bezerra" value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border rounded-xl px-3.5 py-3 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Curso de Graduação</label>
                  <input
                    type="text" required placeholder="Ex: Engenharia" value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    className="w-full text-xs bg-slate-50 border rounded-xl px-3.5 py-3 outline-none"
                  />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-[#0066ff] text-white rounded-xl text-xs font-bold shadow-md">
                  {isLoading ? 'Registrando...' : 'Entrar na Chamada Ao Vivo'}
                </button>
              </form>
            </div>
          ) : scanStatus.type === 'success' ? (
            <div className="bg-white rounded-3xl border shadow-xl p-8 space-y-4 text-center">
              <h3 className="text-xl font-black text-emerald-600">Presença Confirmada!</h3>
              <p className="text-xs text-slate-500">Seus dados foram salvos no painel do professor!</p>
              <button onClick={() => setScanStatus({ type: 'idle', message: '' })} className="text-xs text-blue-600 underline font-bold">
                Escanear Novamente
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border shadow-lg p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-bold text-slate-800">{currentStudent.name}</span>
                <button onClick={() => setCurrentStudent(null)} className="text-[10px] text-red-500">Alterar Ficha</button>
              </div>

              <div className="rounded-2xl bg-black h-32 flex flex-col items-center justify-center text-center text-white p-4">
                <Camera className="w-6 h-6 text-blue-400 mb-1" />
                <p className="text-[10px] text-slate-400">Insira abaixo o código rotativo de 4 letras visível no telão.</p>
              </div>

              {scanStatus.type === 'error' && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {scanStatus.message}
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text" placeholder="Código do Telão (Ex: LIVE-ON95)" value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full bg-slate-50 border text-center font-mono font-bold rounded-xl py-3 outline-none uppercase"
                />
                <button onClick={() => handleScanOrSubmitCode(manualCode)} disabled={isLoading} className="w-full bg-[#0066ff] text-white font-bold text-xs py-3 rounded-xl">
                  Registrar Presença
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
