import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TableProperties, 
  CheckCircle2, 
  AlertCircle, 
  UserPlus, 
  Users, 
  Activity 
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from 'qrcode.react';

// Inicialização segura do Supabase (Se der erro, o app não quebra)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    console.warn("Supabase não pôde ser inicializado, rodando em modo demonstração.", e);
  }
}

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
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
}

export default function PresentationMode({ onBack }: PresentationModeProps) {
  const [role, setRole] = useState<'presenter' | 'student'>('presenter');
  const [activeToken, setActiveToken] = useState<string>('LIVE-ON95');
  const [students, setStudents] = useState<PresentationStudent[]>([]);
  const [attendances, setAttendances] = useState<PresentationAttendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Estados do formulário do Aluno
  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState({ type: 'idle', message: '' });

  // 1. Detecta o modo aluno e preenche o Token vindo do QR Code automaticamente
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'apresentacao_aluno') {
      setRole('student');
    }
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setManualCode(tokenParam.toUpperCase());
    }
  }, []);

  // 2. Sincronização em tempo real com Supabase (com salvaguarda local)
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) return;
      try {
        const { data: attData } = await supabase.from('attendances').select('*').order('created_at', { ascending: false });
        if (attData) {
          const mappedAtt: PresentationAttendance[] = attData.map((d: any) => ({
            id: d.id,
            studentId: d.student_id,
            studentName: d.student_name,
            course: d.course,
            semester: d.semester || '1º Semestre',
            scannedAt: d.created_at,
            tokenUsed: d.token_used
          }));
          setAttendances(mappedAtt);
        }

        const { data: stdData } = await supabase.from('students').select('*');
        if (stdData) {
          const mappedStd: PresentationStudent[] = stdData.map((d: any) => ({
            id: d.id,
            name: d.name,
            course: d.course,
            semester: d.semester || '1º Semestre'
          }));
          setStudents(mappedStd);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do Supabase:", err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 3000); // Atualiza a planilha a cada 3s
    return () => clearInterval(interval);
  }, []);

  // 3. Atualização automática do Token e do QR Code a cada 10 segundos (Infalível)
  useEffect(() => {
    const tokens = ['LIVE-ON95', 'TECH-77X', 'CODE-404', 'DATA-99B', 'VITE-2026', 'CLOUD-88Z', 'DEV-101X'];
    const interval = setInterval(() => {
      const currentIndex = tokens.indexOf(activeToken);
      const nextIndex = (currentIndex + 1) % tokens.length;
      setActiveToken(tokens[nextIndex]);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeToken]);

  // Função dinâmica para pegar a URL base do seu site na Vercel
  const getBaseUrl = () => {
    return `${window.location.origin}${window.location.pathname}`;
  };

  // Cadastro do Aluno
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentCourse.trim()) return;

    setIsLoading(true);
    const mockStudent: PresentationStudent = {
      id: 'std-' + Math.random().toString(36).substring(2, 7),
      name: studentName,
      course: studentCourse,
      semester: '1º Semestre'
    };

    if (supabase) {
      try {
        await supabase.from('students').insert([{
          id: mockStudent.id,
          name: mockStudent.name,
          course: mockStudent.course
        }]);
      } catch (err) {
        console.error("Erro ao salvar estudante no Supabase:", err);
      }
    }

    setStudents(prev => [mockStudent, ...prev]);
    setCurrentStudent(mockStudent);
    setIsLoading(false);
  };

  // Envio do Token / Confirmação de Presença
  const handleScanOrSubmitCode = async () => {
    if (!currentStudent || !manualCode.trim()) return;

    if (manualCode.trim().toUpperCase() !== activeToken) {
      setScanStatus({ 
        type: 'error', 
        message: 'Código expirado ou inválido! Olhe o novo código no telão do professor.' 
      });
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

    if (supabase) {
      try {
        await supabase.from('attendances').insert([{
          student_id: newAttendance.studentId,
          student_name: newAttendance.studentName,
          course: newAttendance.course,
          token_used: newAttendance.tokenUsed
        }]);
      } catch (err) {
        console.error("Erro ao salvar presença no Supabase:", err);
      }
    }

    setAttendances(prev => [newAttendance, ...prev]);
    setScanStatus({ type: 'success', message: 'Sua presença foi registrada com sucesso!' });
    setIsLoading(false);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased">
      {/* Navbar Superior Profissional */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-4 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 animate-pulse" /> OnClass <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium border border-blue-100">Live Dashboard</span>
            </h1>
          </div>
        </div>
        
        {/* Chaveador de Visão para Testes Rápidos */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex text-xs font-semibold">
          <button onClick={() => setRole('presenter')} className={`py-2 px-4 rounded-lg transition-all ${role === 'presenter' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Tela do Projetor
          </button>
          <button onClick={() => setRole('student')} className={`py-2 px-4 rounded-lg transition-all ${role === 'student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Simular Aluno
          </button>
        </div>
      </header>

      {role === 'presenter' ? (
        /* ==================== MODO PROJETOR (TELA CHEIA PARA A SALA) ==================== */
        <main className="p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          
          {/* Coluna Esquerda: QR Codes Dinâmicos */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Passo 1: Acesso ao App */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full mb-3">Passo 1</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Acesse a Lista de Presença</h3>
              <p className="text-xs text-slate-500 mb-4">Abra a câmera do celular e escaneie para entrar no sistema</p>
              
              <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-inner transition hover:scale-105 duration-300">
                <QRCodeSVG value={`${getBaseUrl()}?mode=apresentacao_aluno`} size={170} level="H" />
              </div>
            </div>

            {/* Passo 2: Código Dinâmico */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Atualizando Live
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full mb-3">Passo 2</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Valide sua Presença</h3>
              <p className="text-xs text-slate-500 mb-4">Escaneie para validar o token ou digite o código abaixo</p>
              
              <div className="p-4 border border-slate-100 rounded-2xl bg-white shadow-inner mb-4 transition hover:scale-105 duration-300">
                <QRCodeSVG value={`${getBaseUrl()}?mode=apresentacao_aluno&token=${activeToken}`} size={170} level="H" />
              </div>

              <div className="w-full bg-slate-900 text-emerald-400 font-mono text-2xl font-bold tracking-widest py-3 px-6 rounded-xl shadow-lg border border-slate-800 flex items-center justify-center gap-2">
                {activeToken}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Painel de Chamada em Tempo Real */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col min-h-[510px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-blue-600" /> Lista de Frequência em Tempo Real
              </h3>
              <div className="flex gap-2">
                <div className="text-xs font-bold bg-slate-100 text-slate-700 py-1.5 px-3 rounded-lg flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" /> Alunos: {students.length}
                </div>
                <div className="text-xs font-bold bg-emerald-50 text-emerald-700 py-1.5 px-3 rounded-lg flex items-center gap-1.5 border border-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmados: {attendances.length}
                </div>
              </div>
            </div>

            {/* Tabela Formatada */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-3.5">Nome Completo</th>
                    <th className="p-3.5">Curso / Turma</th>
                    <th className="p-3.5 text-center">Token Validado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendances.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center p-12 text-slate-400">
                        <UserPlus className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        Nenhuma presença confirmada ainda.<br/>Escaneie o QR Code para começar!
                      </td>
                    </tr>
                  ) : (
                    attendances.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 font-semibold text-slate-900">{item.studentName}</td>
                        <td className="p-3.5 text-slate-500 font-medium">{item.course}</td>
                        <td className="p-3.5 text-center">
                          <span className="font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded-md border border-emerald-100">
                            {item.tokenUsed}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        /* ==================== MODO ALUNO (INTERFACE MOBILE PREMIUM) ==================== */
        <main className="p-4 max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          
          {/* Passo A: Ficha Cadastral inicial */}
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-5">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Portal do Aluno</h3>
                <p className="text-xs text-slate-500">Identifique-se para validar sua presença na aula</p>
              </div>

              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Ana Silva" 
                    value={studentName} 
                    onChange={e => setStudentName(e.target.value)} 
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Seu Curso / Matéria</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Engenharia de Software" 
                    value={studentCourse} 
                    onChange={e => setStudentCourse(e.target.value)} 
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:border-blue-500 focus:bg-white transition-all font-medium text-slate-800"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Avançar para Validação
                </button>
              </form>
            </div>
          ) : scanStatus.type === 'success' ? (
            /* Passo C: Tela de Sucesso Completo */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Presença Confirmada!</h3>
                <p className="text-xs text-slate-500 mt-1">Parabéns <b>{currentStudent.name}</b>, seu nome já foi inserido na listagem oficial ao vivo do professor.</p>
              </div>
            </div>
          ) : (
            /* Passo B: Validação do Token de Presença */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Perfil Ativo</span>
                  <div className="text-xs font-bold text-slate-800">{currentStudent.name}</div>
                </div>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">{currentStudent.course}</span>
              </div>

              {scanStatus.type === 'error' && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100 flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanStatus.message}</span>
                </div>
              )}

              <div className="space-y-2 text-center">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Insira o Código do Telão</label>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="DIGITE AQUI" 
                  value={manualCode} 
                  onChange={e => setManualCode(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 text-center font-mono text-xl font-bold rounded-xl p-3.5 outline-none focus:border-blue-500 focus:bg-white uppercase tracking-widest text-slate-800 transition-all"
                />
                <p className="text-[10px] text-slate-400">Caso tenha lido o segundo QR Code, o código já vem preenchido!</p>
              </div>

              <button 
                onClick={handleScanOrSubmitCode} 
                disabled={isLoading || !manualCode.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-3.5 rounded-xl shadow-md active:scale-[0.98] transition-all"
              >
                Confirmar Presença
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
