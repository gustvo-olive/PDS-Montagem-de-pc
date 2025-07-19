/**
 * @file Página Inicial (HomePage).
 * @module pages/HomePage
 * @description Este componente renderiza a página de destino (landing page) da aplicação.
 * Ele apresenta o propósito do CodeTugaBuilds, destaca seus principais recursos e
 * fornece uma chamada à ação (CTA) principal para iniciar o processo de montagem.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/core/Button';

/**
 * @component HomePage
 * @description A página inicial da aplicação. Serve como uma vitrine para
 * os recursos do montador de PCs inteligente e convida o usuário a iniciar
 * uma nova montagem com a ajuda da IA.
 * @returns {React.ReactElement} A página de destino da aplicação.
 */
const HomePage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <header className="mb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-accent mb-4">
          CodeTugaBuilds
        </h1>
        <p className="text-xl md:text-2xl text-neutral-dark max-w-2xl mx-auto">
          Seu assistente inteligente para montar o PC dos seus sonhos, otimizado para suas necessidades e orçamento.
        </p>
      </header>

      <div className="flex justify-center w-full mb-16">
        <div className="bg-secondary p-8 rounded-xl shadow-2xl transform hover:scale-105 transition-transform duration-300 max-w-lg">
          <h2 className="text-3xl font-semibold text-accent mb-4">Montagem Automática com IA</h2>
          <p className="text-neutral-dark mb-6">
            Não sabe por onde começar? Deixe nossa Inteligência Artificial guiar você. Responda algumas perguntas e receba uma build personalizada em minutos.
          </p>
          <Link to="/build">
            <Button variant="primary" size="lg" className="w-full">
              Iniciar Recomendação IA
            </Button>
          </Link>
        </div>
      </div>

      <section className="max-w-3xl w-full text-left">
        <h3 className="text-2xl font-semibold text-accent mb-6 text-center">Por que CodeTugaBuilds?</h3>
        <ul className="space-y-4">
          {[
            { title: "Recomendações Inteligentes", text: "Nossa IA analisa suas necessidades para sugerir os melhores componentes, considerando até mesmo as condições ambientais do seu espaço.", icon: "🧠" },
            { title: "Economia de Tempo e Dinheiro", text: "Otimizamos sua build para o seu orçamento, ajudando você a fazer escolhas inteligentes e encontrar bons negócios (links de compra em breve!).", icon: "💰" },
            { title: "Fácil de Usar", text: "Interface intuitiva e um chatbot amigável tornam o processo de montagem simples, mesmo para iniciantes.", icon: "✨" },
            { title: "Compatibilidade Garantida", text: "Nossa IA verifica a compatibilidade entre as peças para evitar dores de cabeça na hora da montagem.", icon: "🔧" },
          ].map(feature => (
            <li key={feature.title} className="bg-primary/50 p-4 rounded-lg flex items-start space-x-3 shadow-md">
              <span className="text-2xl">{feature.icon}</span>
              <div>
                <h4 className="font-semibold text-neutral">{feature.title}</h4>
                <p className="text-sm text-neutral-dark">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default HomePage;