import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  Laptop, 
  TableProperties,
  Trash2,
  Smartphone
} from 'lucide-react';
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from 'qrcode.react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  const [studentName, setStudentName] = useState('');
  const [studentCourse, setStudentCourse] = useState('');
  const [currentStudent, setCurrentStudent] = useState<PresentationStudent | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState({ type: 'idle', message: '' });

  // Deteta automaticamente o modo pelo link
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

  // Sincronização automática com Supabase
  useEffect(() => {
    if (!supabaseUrl) return;
    const loadData = async () => {
      try {
        const { data: attData } = await supabase.from('attendances').select('*').order('scannedAt', { ascending: false });
        if (attData) setAttendances(attData);
        const { data: stdData } = await supabase.from('students').select('*');
        if (stdData) setStudents(stdData);
      } catch (err) {
        console.warn(err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Carrossel do Token de 10 em 10 segundos
  useEffect(() => {
    const tokens = ['LIVE-ON95', 'TECH-77X', 'CODE-404', 'DATA-99B', 'VITE-2026'];
    const interval = setInterval(() => {
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
      setActiveToken(randomToken);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStudentShareUrl = () => {
    return `${window.location.origin}${window.location.pathname}?mode=apresentacao_aluno`;
  };

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

    try {
      await supabase.from('students').insert([mockStudent]);
    } catch (e) {}

    setStudents(prev => [mockStudent, ...prev]);
    setCurrentStudent(mockStudent);
    setIsLoading(false);
  };

  const handleScanOrSubmitCode = async () => {
    if (!currentStudent || !manualCode.trim()) return;

    if (manualCode.trim().toUpperCase() !== activeToken) {
      setScanStatus({ type: 'error', message: 'Token expirado ou incorreto! Olhe o novo código no telão.' });
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
    } catch (e) {}

    setAttendances(prev => [newAttendance, ...prev]);
    setScanStatus({ type: 'success', message: 'Presença confirmada!' });
    setIsLoading(false);
  };

  return (
    <div className="w-full min-h-screen bg-[#f3f7fd] flex flex-col font-sans">
      <header className="bg-white border-b py-4 px-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-bold text-[#0b1c30]">OnClass Dashboard Pro</h1>
        </div>
        <div className="flex bg-[#f0f6ff] p-1 rounded-xl border text-xs font-bold">
          <button onClick={() => setRole('presenter')} className={`py-1.5 px-4 rounded-lg ${role === 'presenter' ? 'bg-[#0066ff] text-white' : 'text-slate-600'}`}>
            Projetor
          </button>
          <button onClick={() => setRole('student')} className={`py-1.5 px-4 rounded-lg ${role === 'student' ? 'bg-[#0066ff] text-white' : 'text-slate-600'}`}>
            Aluno
          </button>
        </div>
      </header>

      {role === 'presenter' ? (
        <main className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl w-full mx-auto">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col items-center text-center">
              <h4 className="text-xs font-bold text-slate-800 mb-3">Passo 1: Entrar no App</h4>
              <div className="p-2 border rounded-xl bg-white shadow-sm">
                <QRCodeSVG value={getStudentShareUrl()} size={150} />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col items-center text-center">
              <h4 className="text-xs font-bold text-slate-800 mb-3">Passo 2: Validar Presença</h4>
              <div className="p-2 border rounded-xl bg-white shadow-sm mb-3">
                <QRCodeSVG value={`${getStudentShareUrl()}&token=${activeToken}`} size={150} />
              </div>
              <div className="bg-[#10b981] text-white px-6 py-2 rounded-xl font-mono text-xl font-bold tracking-widest">
                {activeToken}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-3xl border shadow-sm p-6 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-blue-600" /> Lista de Presença Ao Vivo
              </h3>
              <div className="flex gap-3">
                <div className="text-xs font-bold bg-slate-100 py-1 px-3 rounded-lg">Inscritos: {students.length}</div>
                <div className="text-xs font-bold bg-emerald-100 text-emerald-700 py-1 px-3 rounded-lg">Presenças: {attendances.length}</div>
              </div>
            </div>

            <div className="flex-1 overflow-auto max-h-[300px] border rounded-xl text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b font-bold text-slate-600">
                  <tr>
                    <th className="p-3">Nome</th>
                    <th className="p-3">Curso</th>
                    <th className="p-3 text-center">Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{item.studentName}</td>
                      <td className="p-3 text-slate-500">{item.course}</td>
                      <td className="p-3 text-center font-mono text-emerald-600 font-bold">{item.tokenUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        <main className="p-4 max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
          {!currentStudent ? (
            <div className="bg-white rounded-3xl border shadow-md p-6 space-y-4">
              <h3 className="text-base font-bold text-center">Ficha do Aluno</h3>
              <form onSubmit={handleEnrollStudent} className="space-y-4">
                <input type="text" placeholder="Nome Completo" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full text-xs bg-slate-50 border rounded-xl p-3 outline-none"/>
                <input type="text" placeholder="Seu Curso" value={studentCourse} onChange={e => setStudentCourse(e.target.value)} className="w-full text-xs bg-slate-50 border rounded-xl p-3 outline-none"/>
                <button type="submit" disabled={isLoading} className="w-full py-3 bg-[#0066ff] text-white rounded-xl text-xs font-bold">Entrar</button>
              </form>
            </div>
          ) : scanStatus.type === 'success' ? (
            <div className="bg-white rounded-3xl border shadow-md p-6 text-center space-y-3">
              <h3 className="text-base font-bold text-emerald-600">Presença Confirmada!</h3>
              <p className="text-xs text-slate-500">O seu nome já está na planilha do professor.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border shadow-md p-6 space-y-4">
              <div className="text-xs font-bold border-b pb-2">{currentStudent.name}</div>
              {scanStatus.type === 'error' && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">{scanStatus.message}</div>}
              <input type="text" placeholder="Código do Telão" value={manualCode} onChange={e => setManualCode(e.target.value)} className="w-full bg-slate-50 border text-center font-mono font-bold rounded-xl p-3 outline-none uppercase"/>
              <button onClick={handleScanOrSubmitCode} disabled={isLoading} className="w-full bg-[#0066ff] text-white font-bold text-xs py-3 rounded-xl">Confirmar Token</button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
