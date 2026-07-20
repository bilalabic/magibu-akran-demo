import { CriterionType } from "@/lib/generated/prisma/enums";

// FR-7.3/7.4/7.5: Varsayılan rubrik — en az iki sayısal kriter (1-10) ve
// "Başarılı Noktalar" + "Geliştirilmesi Gereken Alanlar" metin alanları.
export const DEFAULT_RUBRIC = {
  title: "Varsayılan Değerlendirme Rubriği",
  description: "Sayısal puanlar 1-10 aralığındadır.",
  criteria: [
    {
      title: "İçerik ve Kapsam",
      description: "Ödev gereksinimlerinin karşılanma düzeyi",
      type: CriterionType.SCORE,
      required: true,
      order: 1,
      minScore: 1,
      maxScore: 10,
    },
    {
      title: "Uygulama Kalitesi",
      description: "Çalışmanın teknik/işçilik kalitesi",
      type: CriterionType.SCORE,
      required: true,
      order: 2,
      minScore: 1,
      maxScore: 10,
    },
    {
      title: "Başarılı Noktalar",
      description: "Bu teslimde beğendiğiniz yönleri yazın",
      type: CriterionType.TEXT,
      required: true,
      order: 3,
      minScore: null,
      maxScore: null,
    },
    {
      title: "Geliştirilmesi Gereken Alanlar",
      description: "Nasıl daha iyi olabilirdi? Yapıcı önerilerinizi yazın",
      type: CriterionType.TEXT,
      required: true,
      order: 4,
      minScore: null,
      maxScore: null,
    },
  ],
} as const;
