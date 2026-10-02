FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY HattrickAI.V5.csproj .
RUN dotnet restore HattrickAI.V5.csproj
COPY . .
RUN dotnet publish HattrickAI.V5.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:10000
ARG BUILD_SHA=dev
ENV V6_BUILD=${BUILD_SHA}
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet","HattrickAI.V5.dll","--hostBuilder:reloadConfigOnChange=false"]
