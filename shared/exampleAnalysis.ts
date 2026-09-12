import type { AnalysisResult } from '../types';

export const EXAMPLE_INPUT = '문제: 2x + 3 = 7을 풀어 주세요.\n내 풀이: 2x = 7 + 3 → 2x = 10 → x = 5';

// Authored, offline example. This is not a saved model response or measured evaluation.
export const EXAMPLE_ANALYSIS: AnalysisResult = {
  problemLatex: '2x + 3 = 7',
  problemDescription: '일차방정식에서 x의 값을 구해 보세요.',
  studentPath: {
    type: 'student', name: '내 풀이', description: '이항할 때의 부호를 함께 확인해요.',
    steps: [
      { stepNumber: 1, latex: '2x + 3 = 7', explanation: '처음 주어진 식을 옮겨 적었어요.' },
      { stepNumber: 2, latex: '2x = 7 + 3', explanation: '왼쪽의 +3을 없애려면 양변에서 3을 빼야 해요. 오른쪽에서도 3을 빼야 등식이 유지됩니다.', isError: true, correction: '2x + 3 - 3 = 7 - 3 \\quad\\Rightarrow\\quad 2x = 4' },
      { stepNumber: 3, latex: 'x = 5', explanation: '앞 단계의 부호 오류가 답까지 이어졌어요. 올바른 식 2x = 4의 양변을 2로 나누면 x = 2예요.', isError: true, correction: 'x = \\frac{4}{2} = 2' },
    ],
  },
  alternatives: [{
    type: 'standard', name: '표준 풀이', description: '등식의 성질을 이용해 한 단계씩 풀어요.',
    steps: [
      { stepNumber: 1, latex: '2x + 3 - 3 = 7 - 3', explanation: '양변에서 같은 수 3을 빼요.', strategy: '등식의 성질' },
      { stepNumber: 2, latex: '2x = 4', explanation: '양변을 정리해요.' },
      { stepNumber: 3, latex: 'x = 2', explanation: '양변을 2로 나눠요. 원래 식에 넣으면 2 × 2 + 3 = 7로 확인할 수 있어요.' },
    ],
  }],
  missingPaths: [
    { type: 'shortcut', reason: '이 예시에서는 등식의 성질을 익히는 데 집중하도록 표준 풀이만 제공합니다.' },
    { type: 'genius', reason: '기본 일차방정식으로, 별도의 심화 풀이를 제공하지 않습니다.' },
  ],
  feedback: { accuracy: 35, conceptualUnderstanding: 60, strategyEfficiency: 70, summary: 'x만 남기려는 방향은 좋아요. 2단계에서 양변에 같은 연산을 적용하는지 확인해 보세요. 이 화면은 직접 작성한 예시이며 점수도 예시 값입니다.' },
};
