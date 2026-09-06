// Módulo Áudio Coach (Avisos por voz no fone)
class AudioCoach {
  constructor() {
    this.enabled = true;
    this.intervalKm = 1.0;
    this.nextMilestoneKm = 1.0;
    this.voice = null;
    this.synth = window.speechSynthesis;
    this.initVoice();
  }

  initVoice() {
    if (!this.synth) {
      console.warn('SpeechSynthesis não suportado neste navegador.');
      return;
    }

    const selectVoice = () => {
      const voices = this.synth.getVoices();
      // Priorizar vozes em Português do Brasil (pt-BR)
      this.voice = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Natural') || v.name.includes('Brazil'))) ||
                   voices.find(v => v.lang.startsWith('pt')) ||
                   voices[0];
    };

    selectVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = selectVoice;
    }
  }

  reset(intervalKm = 1.0) {
    this.intervalKm = intervalKm;
    this.nextMilestoneKm = intervalKm;
  }

  speak(text, isHighPriority = false) {
    if (!this.enabled || !this.synth) return;

    if (isHighPriority) {
      this.synth.cancel(); // Interrompe fala anterior se for prioridade
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05; // Velocidade esportiva um pouco mais ágil
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      this.synth.speak(utterance);
    } catch (e) {
      console.error('Erro ao sintetizar áudio coach:', e);
    }
  }

  // Verifica se completou um novo marco de quilometragem e fala
  checkDistanceMilestone(currentDistanceKm, movingTimeSec, avgSpeedKmH) {
    if (!this.enabled) return;
    if (currentDistanceKm <= 0) return;

    if (currentDistanceKm >= this.nextMilestoneKm) {
      const completedKm = Math.floor(this.nextMilestoneKm);
      const minutes = Math.floor(movingTimeSec / 60);
      const seconds = Math.floor(movingTimeSec % 60);
      
      let timeStr = '';
      if (minutes > 0) {
        timeStr += `${minutes} minuto${minutes > 1 ? 's' : ''}`;
        if (seconds > 0) timeStr += ` e ${seconds} segundos`;
      } else {
        timeStr += `${seconds} segundos`;
      }

      const speedStr = avgSpeedKmH.toFixed(1).replace('.', ' vírgula ');
      const message = `Quilômetro ${completedKm} concluído. Tempo em movimento: ${timeStr}. Média de ${speedStr} quilômetros por hora.`;

      this.speak(message, true);
      this.nextMilestoneKm += this.intervalKm;
    }
  }

  speakAutoPause() {
    this.speak('Pedal pausado.', false);
  }

  speakAutoResume() {
    this.speak('Pedal retomado.', false);
  }

  speakStart() {
    this.speak('Gravação de pedal iniciada. Bom treino!', true);
  }

  speakFinish(distanceKm, durationSec, avgSpeedKmH) {
    const kmStr = distanceKm.toFixed(1).replace('.', ' vírgula ');
    const min = Math.round(durationSec / 60);
    const speedStr = avgSpeedKmH.toFixed(1).replace('.', ' vírgula ');
    this.speak(`Treino concluído! Foram ${kmStr} quilômetros em ${min} minutos com velocidade média de ${speedStr} km por hora. Parabéns!`, true);
  }

  testVoice() {
    this.speak('Aviso por voz ativado! A cada quilômetro falarei no seu fone o seu ritmo e tempo.', true);
  }
}

window.audioCoach = new AudioCoach();
