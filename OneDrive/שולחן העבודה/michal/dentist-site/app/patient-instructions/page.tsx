import Section from "@/components/Section";
import PatientInstructionsCenter from "@/components/PatientInstructionsCenter";

export default function PatientInstructionsPage() {
  return (
    <Section
      title="מרכז הדרכה למטופל"
      subtitle="בחרו סוג טיפול וקבלו הנחיות ברורות לפי שלבי הזמן."
    >
      <PatientInstructionsCenter />
    </Section>
  );
}
