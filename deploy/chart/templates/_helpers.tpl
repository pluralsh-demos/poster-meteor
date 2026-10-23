{{/*
Chart name. Workload names stay unqualified (api, web) because each slot
has its own namespace.
*/}}
{{- define "poster-meteor.name" -}}
{{- .Chart.Name -}}
{{- end }}

{{/*
Chart name and version, used by the standard Helm chart label.
*/}}
{{- define "poster-meteor.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{/*
Ingress host: <pack.hostnamePrefix>-<slot.number>.<domain>
Example: poster-meteor-01.backlot.plural.sh
*/}}
{{- define "poster-meteor.hostname" -}}
{{- printf "%s-%s.%s" .Values.pack.hostnamePrefix .Values.slot.number .Values.domain -}}
{{- end }}

{{/*
CNPG Cluster name. The operator creates the <name>-app secret; its uri key is DATABASE_URL.
*/}}
{{- define "poster-meteor.clusterName" -}}
poster-meteor
{{- end }}

{{- define "poster-meteor.databaseSecret" -}}
{{- printf "%s-app" (include "poster-meteor.clusterName" .) -}}
{{- end }}

{{- define "poster-meteor.api.image" -}}
{{- printf "%s:%s" .Values.api.image.repository .Values.api.image.tag -}}
{{- end }}

{{- define "poster-meteor.web.image" -}}
{{- printf "%s:%s" .Values.web.image.repository .Values.web.image.tag -}}
{{- end }}

{{- define "poster-meteor.worker.image" -}}
{{- printf "%s:%s" .Values.worker.image.repository .Values.worker.image.tag -}}
{{- end }}

{{/*
CNPG parameter values are strings.
*/}}
{{- define "poster-meteor.postgres.maxConnections" -}}
{{- .Values.postgres.maxConnections | toString | quote -}}
{{- end }}

{{- define "poster-meteor.labels" -}}
helm.sh/chart: {{ include "poster-meteor.chart" . }}
app.kubernetes.io/name: {{ include "poster-meteor.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: poster-meteor
{{- end }}

{{- define "poster-meteor.selectorLabels" -}}
app.kubernetes.io/name: {{ include "poster-meteor.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Workload labels. api and web keep distinct names so their selectors do not overlap.
*/}}
{{- define "poster-meteor.workloadLabels" -}}
helm.sh/chart: {{ include "poster-meteor.chart" .root }}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: poster-meteor
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{- define "poster-meteor.workloadSelectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}
