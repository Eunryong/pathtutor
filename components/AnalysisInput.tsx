import React, { useRef, useState } from 'react';
import { ArrowRight, Upload, GitBranch } from 'lucide-react';

interface AnalysisInputProps {
  inputProblem: string;
  selectedFile: File | null;
  previewUrl: string | null;
  errorMessage: string | null;
  canSubmit: boolean;
  onInputChange: (value: string) => void;
  onFileChange: (file: File | null) => boolean;
  onUseSample: () => void;
  onSubmit: () => void;
  onExample?: () => void;
  hasStudentWork?: boolean;
  onModeChange?: (value: boolean) => void;
}

export default function AnalysisInput(props: AnalysisInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <div className="input-page">
    <section className="intro">
      <p className="eyebrow">정답보다 중요한, 생각의 과정</p>
      <h1>내 풀이,<br />어디서 <em>달라졌을까?</em></h1>
      <p className="intro-copy">풀어본 흔적을 그대로 보여 주세요.<br />한 단계씩 짚어 보고, 다른 풀이와 비교해요.</p>
      <div className="notebook-example" role="group" aria-label="이항 오류를 고치는 예시">
        <span className="note-caption">이렇게 함께 살펴봐요</span>
        <div className="note-line">2x + 3 = 7</div>
        <div className="note-line wrong">2x = 7 + 3 <span>부호를 확인해요</span></div>
        <div className="note-line corrected">2x = 7 − 3 <span>양변에서 3을 빼면 돼요</span></div>
      </div>
      {props.onExample && <><button className="text-button" onClick={props.onExample}><GitBranch size={18} /> 예시 결과 둘러보기 <ArrowRight size={16} /></button><p className="small muted">예시 결과는 AI 호출 없이 바로 볼 수 있어요.</p></>}
    </section>
    <section className="paper input-paper" aria-label="문제 입력">
      <div className="section-heading"><h2>어떤 문제를 풀고 있나요?</h2><span className="small muted">이미지 또는 텍스트</span></div>
      <div className="mode-switch" role="group" aria-label="입력 종류">
        <button aria-pressed={props.hasStudentWork !== false} onClick={() => props.onModeChange?.(true)}>내 풀이 첨삭</button>
        <button aria-pressed={props.hasStudentWork === false} onClick={() => props.onModeChange?.(false)}>문제만 질문</button>
      </div>
      <label className={'upload-zone' + (dragging ? ' dragging' : '')}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) props.onFileChange(file); }}>
        <input ref={fileRef} className="sr-only" type="file" aria-label="풀이 이미지 업로드" accept="image/png,image/jpeg,image/webp"
          onChange={event => { const file = event.target.files?.[0]; if (file) props.onFileChange(file); event.currentTarget.value = ''; }} />
        {props.previewUrl ? <img src={props.previewUrl} alt="선택한 풀이 미리보기" /> : <><Upload size={26} /><strong>풀이 사진을 올려 주세요</strong><span>클릭하거나 파일을 끌어 놓으세요</span><small>PNG · JPG · WEBP / 최대 6MB</small></>}
      </label>
      {props.selectedFile && <div className="file-actions"><span title={props.selectedFile.name}>{props.selectedFile.name}</span>{props.previewUrl && <a href={props.previewUrl} target="_blank" rel="noreferrer">크게 보기</a>}<button onClick={() => fileRef.current?.click()}>교체</button><button onClick={() => props.onFileChange(null)}>삭제</button></div>}
      <label className="field-label" htmlFor="problem-input">문제 또는 풀이 입력</label>
      <textarea id="problem-input" value={props.inputProblem} maxLength={11800} aria-describedby={props.errorMessage ? 'input-error' : undefined}
        onChange={event => props.onInputChange(event.target.value)}
        onPaste={(event: React.ClipboardEvent<HTMLTextAreaElement>) => { const files = event.clipboardData.files as FileList; const image = Array.from(files).find(file => file.type.startsWith('image/')); if (image) { event.preventDefault(); props.onFileChange(image); } }}
        placeholder={props.hasStudentWork === false ? '궁금한 문제를 적어 주세요. 사진만 올려도 괜찮아요.' : '문제와 내가 푼 과정을 적어 주세요. 예: 2x + 3 = 7 → 2x = 7 + 3 → x = 5'} />
      <div className="input-meta"><button className="text-button" onClick={props.onUseSample}>예제 입력하기</button><span>{props.inputProblem.length.toLocaleString()} / 11,800</span></div>
      {props.errorMessage && <div id="input-error" className="error-banner" role="alert">{props.errorMessage}</div>}
      <button className="primary submit" disabled={!props.canSubmit} onClick={props.onSubmit}>풀이 분석하기 <ArrowRight size={18} /></button>
      <p className="small muted privacy-note">분석 시 입력 내용이 AI 서비스로 전송됩니다.<br />이름·학교 등 개인정보는 가리고 올려 주세요.</p>
    </section>
  </div>;
}
