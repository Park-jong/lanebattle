import { buildCopy } from '../ui/build/theme';
import { gameSkin } from './skin';

const ENEMIES: [string, string][] = [
  ['물귀신 투척병', '스피터'], ['장승 망령', '아머드'], ['처녀귀신', '스토커'],
  ['달걀귀신', '워커'], ['어둑시니', '호버'], ['그슨대', '그로워'],
  ['손각시', '블라이터'], ['저승사자', '디스럽터'], ['강철이', '아이언클래드'], ['두억시니', '브리처'],
];

export function skinText(text: string): string {
  if (gameSkin.current === 'default') return text;
  let result = buildCopy(text, 'military');
  for (const [from, to] of ENEMIES) result = result.split(from).join(to);
  return result.split('꼬마 지휘관').join('시온').split('굿당').join('지휘소').split('봉인').join('방호');
}
