import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

const AiAssistantContext = createContext(null)

export function AiAssistantProvider({ children }) {
  const location = useLocation()

  const [selectedHazard, setSelectedHazard] = useState(null)
  const [recentAssessment, setRecentAssessment] = useState(null)
  const [recentMachineWeaknesses, setRecentMachineWeaknesses] = useState([])
  const [recommendedDomain, setRecommendedDomain] = useState(null)

  // Clear transient selected hazard when changing routes
  useEffect(() => {
    setSelectedHazard(null)
  }, [location.pathname])

  const setAiHazard = useCallback((hazard) => {
    if (!hazard) {
      setSelectedHazard(null)
      return
    }
    setSelectedHazard({
      id: hazard.id,
      label: hazard.label || hazard.name,
      category: hazard.category || 'General',
      severity: hazard.severity || 'medium',
      confidence: hazard.confidence,
      evidence: hazard.evidence || hazard.description,
      description: hazard.description,
      recommendedAction: hazard.recommendedAction || hazard.action,
      ppe: hazard.ppe || [],
    })
  }, [])

  const setAiAssessmentResult = useCallback((res) => {
    if (!res) {
      setRecentAssessment(null)
      return
    }
    setRecentAssessment({
      domain: res.domain,
      score: res.score,
      passed: Boolean(res.passed),
      totalQuestions: res.total_questions || res.totalQuestions,
      weakTopics: Array.isArray(res.weak_topics) ? res.weak_topics : res.weakTopics || [],
      recommendations: res.recommendations || [],
    })
    if (!res.passed && res.domain) {
      setRecommendedDomain(res.domain)
    }
  }, [])

  const setAiMachineWeaknesses = useCallback((weaknesses, recDomain = null) => {
    setRecentMachineWeaknesses(Array.isArray(weaknesses) ? weaknesses : [])
    if (recDomain) {
      setRecommendedDomain(recDomain)
    }
  }, [])

  const contextPayload = useMemo(() => {
    return {
      currentRoute: location.pathname,
      selectedHazard,
      recentAssessment,
      recentMachineWeaknesses,
      recommendedDomain,
    }
  }, [location.pathname, selectedHazard, recentAssessment, recentMachineWeaknesses, recommendedDomain])

  const value = {
    contextPayload,
    selectedHazard,
    recentAssessment,
    recentMachineWeaknesses,
    recommendedDomain,
    setAiHazard,
    setAiAssessmentResult,
    setAiMachineWeaknesses,
    setRecommendedDomain,
  }

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
    </AiAssistantContext.Provider>
  )
}

export function useAiAssistant() {
  const ctx = useContext(AiAssistantContext)
  if (!ctx) {
    return {
      contextPayload: {},
      selectedHazard: null,
      recentAssessment: null,
      recentMachineWeaknesses: [],
      recommendedDomain: null,
      setAiHazard: () => {},
      setAiAssessmentResult: () => {},
      setAiMachineWeaknesses: () => {},
      setRecommendedDomain: () => {},
    }
  }
  return ctx
}
