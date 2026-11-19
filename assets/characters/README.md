# 캐릭터 기본 이미지

2026-11-05 영웅 탑승형 추가: manifest의 `hero:kkomaMudang`은 `runtime/hero-kkomaMudang-mounted-haetae.png`와 JSON을 사용한다. 기존 해태 아군은 그대로다. [제작·적용 기록](../../../docs/art/default/GENERATED.md#동자-해태-탑승형-2026-11-05)과 [재구성 도구](../../../scripts/build-mounted-hero.mjs)를 참고한다. 도보형 런타임 파일은 보관본으로 남아 있다.

2026-11-04에 `docs/art/default/`의 기본 캐릭터 26종 명세를 바탕으로 생성한 SD 캐릭터 이미지다.

- `manifest.json`: 대상 키·텍스처 경로·기준점·기준 몸체 크기·프레임 순서와 재생 속도.
- `runtime/<분류>-<종류ID>.png` / `.json`: 작은 JSON hash 아틀라스. 프레임 키는 원본 파일명에서 확장자를 뺀 값이다.
- 로컬 원본 폴더의 `skin.json`, `source-atlas.png`, `generation-prompt.txt`: 캔버스 규격과 선택된 생성 원본·프롬프트를 보존한다.

현재 배포 폴더에는 `runtime/`의 소형 아틀라스 26쌍과 manifest만 둔다. 원본 674개 개별 PNG와 큰 아틀라스·프롬프트는 `output/art-generation/source-assets/`로 보존 이동했으며 배포·Git에서 제외한다. `python scripts/pack-runtime-art.py`로 이 원본에서 런타임 에셋을 재생성한다.

내장 `image_gen`으로 원화를 만들고, 사용자가 지정한 Python 후처리로 파일 분리·약한 알파 노이즈 제거·일부 매트 배경 제거·캔버스와 기준점 정렬·아틀라스 패킹을 수행했다. 재생성 없이 다시 정리하려면 저장소 루트에서 `python scripts/prepare-character-art.py`를 실행한다. Pillow와 NumPy가 필요하다.

파일 규격과 아틀라스 데이터의 자동 검증은 완료했다. 모든 프레임의 해부 구조·팔다리·구미호 꼬리 수와 실제 전투 재생을 최종 승인한 상태는 아니다. 원화가 자동 생성·분리되었으므로 실제 적용 단계에서 포즈별 잔여 조각·실루엣·피벗을 확인한다. 특히 구미호의 아홉 꼬리 표현은 프레임별 추가 보정 대상으로 남긴다.

v0.8.0에서 기본 캐릭터 렌더링과 소환·빌드·타이틀·보스 UI에 연결했다. 기본 동작과 영웅 스킬·종류별 투사체는 사용하며, 모든 보스 고유 포즈가 연결된 것은 아니다. 생성 이력과 검사 결과는 `output/art-generation/`에 있다.
